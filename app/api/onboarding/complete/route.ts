import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { hashPassword } from '@/lib/auth/crypto';
import { randomToken } from '@/lib/auth/crypto';
import {
  notifyOnboardingComplete,
  sendDriverWelcome,
  sendLeaseAgreementForReview,
} from '@/lib/email';
import { LEASE_TERMS_VERSION } from '@/lib/lease-terms';

export async function POST(request: NextRequest) {
  try {
    if (!clientPromise) {
      return NextResponse.json({ ok: false, error: 'MONGODB_URI not configured' }, { status: 500 });
    }

    const formData = await request.formData();

    // Extract form data
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const dateOfBirth = formData.get('dateOfBirth') as string;
    const ssnLast4 = formData.get('ssnLast4') as string;
    const address = formData.get('address') as string;
    const city = formData.get('city') as string;
    const state = formData.get('state') as string;
    const zip = formData.get('zip') as string;
    const truckYear = formData.get('truckYear') as string;
    const truckMake = formData.get('truckMake') as string;
    const truckModel = formData.get('truckModel') as string;
    const vin = formData.get('vin') as string;
    const plate = formData.get('plate') as string;
    const truckType = formData.get('truckType') as string;
    const mcNumber = formData.get('mcNumber') as string;
    const usdotNumber = formData.get('usdotNumber') as string;
    const authorityType = formData.get('authorityType') as string;
    const insuranceCompany = formData.get('insuranceCompany') as string;
    const policyNumber = formData.get('policyNumber') as string;
    const policyExpiration = formData.get('policyExpiration') as string;
    const liabilityCoverage = formData.get('liabilityCoverage') as string;

    // Get documents. Only CDL and COI gate submission (see REQUIRED_DOCS in
    // components/onboarding/OnboardingPortal.tsx); anything missing is tracked
    // as outstanding so a human can chase it instead of the applicant being
    // turned away at the door.
    const ALL_DOC_KEYS = ['cdl', 'coi', 'registration', 'w9', 'dotPhysical', 'mvR', 'eld'];
    const documents: Record<string, any> = {};
    for (const key of ALL_DOC_KEYS) {
      const file = formData.get(key) as File;
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        documents[key] = {
          name: file.name,
          type: file.type,
          size: file.size,
          data: buffer.toString('base64'),
        };
      }
    }
    const outstandingDocuments = ALL_DOC_KEYS.filter((k) => k !== 'eld' && !documents[k]);

    // Fields the applicant explicitly deferred ("I don't have my MC number
    // handy", "send me the lease to review"). Recorded rather than enforced:
    // an application with a known gap is worth vastly more than a person who
    // hit a required field they could not fill and closed the tab.
    let deferredItems: Record<string, string> = {};
    try {
      const raw = formData.get('deferredItems');
      if (typeof raw === 'string' && raw) deferredItems = JSON.parse(raw);
    } catch {
      deferredItems = {};
    }
    const signature = (formData.get('signature') as string) || '';
    const signedAgreement = formData.get('signedAgreement') === 'true';
    const leaseSigned = signedAgreement && !!signature && !deferredItems.leaseSignature;

    const client = await clientPromise;
    const db = client.db();

    // The session this submission belongs to. Sent by the portal; we fall back
    // to an email match so submissions from older clients still close their
    // session rather than stranding it.
    const sessionToken = (formData.get('sessionToken') as string) || '';
    const sessionQuery = sessionToken
      ? { rawToken: sessionToken }
      : { email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };

    // Check if email already exists. A driver who resubmits after a partial
    // failure previously got a hard 400 and had no way forward — the account
    // existed but their session still said "started", so they were locked out
    // of a flow they had already finished. Treat it as already-complete and
    // make sure the session reflects that.
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) {
      await db.collection('onboarding_sessions').updateOne(sessionQuery, {
        $set: {
          status: 'completed',
          completedAt: existing.onboardingCompletedAt || new Date(),
          completedUserId: existing._id,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({
        ok: true,
        alreadyCompleted: true,
        driverUserId: existing._id.toString(),
        message:
          'This application was already submitted. Twin Mile has your information — someone will contact you about next steps.',
      });
    }

    // Create temporary password
    const tempPassword = randomToken(8).slice(0, 8);
    const { saltBase64, hashBase64 } = hashPassword(tempPassword);

    // Create driver user
    const userDoc = {
      email: email.toLowerCase(),
      firstName,
      lastName,
      phone,
      dateOfBirth: new Date(dateOfBirth),
      ssnLast4,
      address: { street: address, city, state, zip },
      truck: { year: truckYear, make: truckMake, model: truckModel, vin, plate, type: truckType },
      authority: { mcNumber, usdotNumber, type: authorityType },
      insurance: { company: insuranceCompany, policyNumber, expiration: new Date(policyExpiration), liabilityCoverage },
      documents,
      outstandingDocuments,
      deferredItems,
      followUpNeeded: outstandingDocuments.length > 0 || Object.keys(deferredItems).length > 0,
      role: 'driver' as const,
      passwordSaltBase64: saltBase64,
      passwordHashBase64: hashBase64,
      mustChangePassword: true,
      isOwnerOperator: true,
      status: 'pending_review',
      onboardingCompletedAt: new Date(),
      createdAt: new Date(),
    };

    const result = await db.collection('users').insertOne(userDoc);

    // Create lease agreement record.
    //
    // signingToken is the capability that makes the deferral real. An applicant
    // who asked to read the agreement first gets it emailed with a link keyed to
    // THIS lease record, so his signature lands on his own row. Minted only when
    // there is something left to sign — an already-signed lease must not carry a
    // live signing link.
    const signingToken = leaseSigned ? null : randomToken(32);
    await db.collection('lease_agreements').insertOne({
      userId: result.insertedId,
      operatorName: `${firstName} ${lastName}`,
      operatorEmail: email,
      operatorPhone: phone,
      operatorAddress: `${address}, ${city}, ${state} ${zip}`,
      // An unsigned lease is a real state, not a failure. It means "this person
      // applied and wants to read it first" — which is a call to make, not a
      // lost applicant.
      status: leaseSigned ? 'pending_review' : 'awaiting_signature',
      signature: leaseSigned ? signature : null,
      signedAt: leaseSigned ? new Date() : null,
      signingToken,
      // Which wording was accepted. Without this a signature cannot be traced to
      // the terms it agreed to once lib/lease-terms.ts changes.
      termsVersion: leaseSigned ? LEASE_TERMS_VERSION : null,
      documents,
      outstandingDocuments,
      deferredItems,
      createdAt: new Date(),
    });

    // Close out the onboarding session.
    //
    // THIS IS THE BUG THAT MADE THE FUNNEL UNREADABLE: nothing in the app ever
    // set a session to "completed", so the last stage of the funnel reported 0
    // no matter what happened, and every agent reasoned against that 0. A
    // metric that cannot move is worse than no metric — it looks like evidence.
    const sessionUpdate = await db.collection('onboarding_sessions').updateOne(sessionQuery, {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        completedUserId: result.insertedId,
        updatedAt: new Date(),
      },
    });

    // Move the source prospect/lead to the end of the funnel too, so the
    // pipeline taxonomy and the session agree.
    if (email) {
      const emailRegex = { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
      await Promise.all([
        db
          .collection('outbound_prospects')
          .updateMany({ email: emailRegex }, { $set: { status: 'ready_to_dispatch', updatedAt: new Date() } }),
        db
          .collection('leads_drivers')
          .updateMany({ email: emailRegex }, { $set: { status: 'ready_to_dispatch', updatedAt: new Date() } }),
      ]);
    }

    // Log activity
    await db.collection('agent_activity').insertOne({
      timestamp: new Date(),
      agent: { name: 'Onboarding Portal', role: 'System' },
      activity: `New driver onboarding completed: ${firstName} ${lastName} (${email})`,
      type: 'onboarding_complete',
      details: {
        userId: result.insertedId.toString(),
        email,
        sessionClosed: sessionUpdate.modifiedCount > 0,
        sessionMatchedBy: sessionToken ? 'token' : 'email',
        leaseSigned,
        outstandingDocuments,
        deferredItems: Object.values(deferredItems),
      },
    });

    // ── Email, all AWAITED, after every write has landed ────────────────────
    //
    // AWAITED deliberately: Vercel freezes the lambda the moment the response is
    // returned, so a fire-and-forget send here would be killed mid-flight and
    // lose exactly the messages that matter most. Every sender below swallows its
    // own failures and returns a boolean, so a mail outage can never fail a
    // submission the driver already finished — he would see an error, assume his
    // application vanished, and his retry would hit the already-completed path.
    //
    // Sent AFTER the DB writes rather than inline with them: if the invocation
    // dies mid-send, the application still exists, the session is still closed
    // and a human still has the record. The reverse order can lose the record.
    const fullName = `${firstName} ${lastName}`.trim();
    const [welcomeEmailSent, agreementEmailSent] = await Promise.all([
      sendDriverWelcome({ fullName, email, tempPassword }),
      // Keeps the promise printed on the deferral checkbox. Guarded because a
      // driver who already signed must not be sent a live signing link.
      signingToken
        ? sendLeaseAgreementForReview({ fullName, email, signingToken })
        : Promise.resolve(true),
    ]);

    // Owner alert last, so it can report whether the applicant's own emails
    // actually left. A failed credentials email means a driver is holding an
    // account he cannot enter and does not know it — only a phone call fixes
    // that, and only if somebody is told.
    await notifyOnboardingComplete({
      fullName,
      email,
      phone: (formData.get('phone') as string) || undefined,
      leaseSigned,
      deferredItems: Object.values(deferredItems),
      outstandingDocuments,
      driverUserId: result.insertedId.toString(),
      welcomeEmailSent,
      agreementEmailSent,
    });

    // tempPassword is deliberately NOT returned. It is a credential, and the
    // browser has no use for it: the portal discarded it anyway, and the only
    // durable delivery is the email above. Returning it put a live password in a
    // JSON body for any extension or proxy log to read.
    return NextResponse.json({
      ok: true,
      driverUserId: result.insertedId.toString(),
      leaseSigned,
      credentialsEmailed: welcomeEmailSent,
      agreementEmailed: signingToken ? agreementEmailSent : false,
      email,
      followUp: [...Object.values(deferredItems), ...outstandingDocuments],
      message: welcomeEmailSent
        ? `Account created. Your login details were emailed to ${email}.`
        : 'Account created. We could not email your login details — Twin Mile will call you.',
    });
  } catch (error) {
    console.error('[api/onboarding/complete] error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to complete onboarding', message: String(error) }, { status: 500 });
  }
}