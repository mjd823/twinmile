import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { hashPassword } from '@/lib/auth/crypto';
import { randomToken } from '@/lib/auth/crypto';

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

    // Get documents
    const documents: Record<string, any> = {};
    for (const key of ['cdl', 'coi', 'registration', 'w9', 'dotPhysical', 'mvR', 'eld']) {
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

    const client = await clientPromise;
    const db = client.db();

    // Check if email already exists
    const existing = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Email already registered' }, { status: 400 });
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

    // Create lease agreement record
    await db.collection('lease_agreements').insertOne({
      userId: result.insertedId,
      operatorName: `${firstName} ${lastName}`,
      operatorEmail: email,
      operatorPhone: phone,
      operatorAddress: `${address}, ${city}, ${state} ${zip}`,
      status: 'pending_review',
      documents,
      createdAt: new Date(),
    });

    // Log activity
    await db.collection('agent_activity').insertOne({
      timestamp: new Date(),
      agent: { name: 'Onboarding Portal', role: 'System' },
      activity: `New driver onboarding completed: ${firstName} ${lastName} (${email})`,
      type: 'onboarding_complete',
      details: { userId: result.insertedId.toString(), email },
    });

    return NextResponse.json({
      ok: true,
      tempPassword,
      driverUserId: result.insertedId.toString(),
      message: `Account created. Temporary password: ${tempPassword}`
    });
  } catch (error) {
    console.error('[api/onboarding/complete] error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to complete onboarding', message: String(error) }, { status: 500 });
  }
}