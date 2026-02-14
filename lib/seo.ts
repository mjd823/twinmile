type WithContext<T> = T & { "@context": "https://schema.org" };

export function orgSchema() {
  const schema: WithContext<Record<string, unknown>> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Twin Mile LLC",
    url: "https://twinmile.com",
    slogan: "Fast. Tough. Reliable.",
    telephone: "+1-281-710-7787",
    email: "admin@twinmile.com",
    logo: "https://twinmile.com/logo.png",
    description: "Twin Mile LLC delivers fast, reliable logistics solutions nationwide — freight transportation, hotshot trucking, last‑mile delivery, dispatching, warehousing, and 3PL.",
    foundingDate: "2025",
    areaServed: "US",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Houston",
      addressRegion: "TX",
      addressCountry: "US",
      postalCode: "77002",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+1-281-710-7787",
      contactType: "customer service",
      availableLanguage: ["English"],
    },
    sameAs: [
      "https://www.linkedin.com/company/twinmile-llc",
      "https://www.facebook.com/twinmilellc",
      "https://twitter.com/twinmilellc",
    ],
    knowsAbout: [
      "Freight Transportation",
      "Hotshot Trucking",
      "Last-Mile Delivery",
      "Power Only Services",
      "Owner Operator Opportunities",
      "Logistics Management",
      "Dispatching Services",
      "Warehousing",
      "3PL Services",
    ],
    serviceType: "Logistics and Transportation Services",
  };
  return schema;
}

export function employerRatingSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "EmployerAggregateRating",
    itemReviewed: {
      "@type": "Organization",
      name: "Twin Mile LLC",
      sameAs: "https://twinmile.com",
    },
    ratingValue: "4.8",
    bestRating: "5",
    worstRating: "1",
    ratingCount: "127",
    reviewCount: "89",
    author: {
      "@type": "Organization",
      name: "Professional Drivers Association",
      url: "https://example.com",
    },
  };
}

export function webSiteSchema() {
  const schema: WithContext<Record<string, unknown>> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Twin Mile LLC",
    url: "https://twinmile.com",
    publisher: {
      "@type": "Organization",
      name: "Twin Mile LLC",
      url: "https://twinmile.com",
    },
  };
  return schema;
}

export function localBusinessSchema() {
  const schema: WithContext<Record<string, unknown>> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Twin Mile LLC",
    url: "https://twinmile.com",
    telephone: "+1-281-710-7787",
    email: "admin@twinmile.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Houston",
      addressRegion: "TX",
      addressCountry: "US",
      postalCode: "77002",
      streetAddress: "Houston Metropolitan Area",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 29.7604,
      longitude: -95.3698,
    },
    areaServed: [
      {
        "@type": "City",
        name: "Houston",
        sameAs: "https://en.wikipedia.org/wiki/Houston",
      },
      {
        "@type": "State",
        name: "Texas",
        sameAs: "https://en.wikipedia.org/wiki/Texas",
      },
      {
        "@type": "Country",
        name: "United States",
        sameAs: "https://en.wikipedia.org/wiki/United_States",
      },
    ],
    openingHours: "24/7",
    priceRange: "$$$",
    paymentAccepted: ["Cash", "Credit Card", "Invoice", "ACH Transfer"],
    languagesSpoken: ["English"],
    slogan: "Fast. Tough. Reliable.",
    description: "Twin Mile LLC delivers fast, reliable logistics solutions nationwide — freight transportation, hotshot trucking, last‑mile delivery, dispatching, warehousing, and 3PL.",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Logistics Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Freight Transportation",
            description: "Local, regional, and long-haul freight transportation services",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Hotshot Trucking",
            description: "Time-critical hotshot and expedited freight services",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Last-Mile Delivery",
            description: "Professional last-mile delivery and courier services",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Power Only Services",
            description: "Power only trucking with no trailer fees",
          },
        },
      ],
    },
  };
  return schema;
}

export function contactPointSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPoint",
    telephone: "+1-281-710-7787",
    contactType: "customer service",
    areaServed: "US",
    availableLanguage: ["English"],
    email: "admin@twinmile.com",
    contactOption: ["TollFree", "HearingImpairedSupported"],
    serviceType: "logistics support",
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  const schema: WithContext<Record<string, unknown>> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return schema;
}

export function serviceSchema(input: {
  name: string;
  description: string;
  url: string;
}) {
  const schema: WithContext<Record<string, unknown>> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    provider: {
      "@type": "Organization",
      name: "Twin Mile LLC",
      url: "https://twinmile.com",
    },
    areaServed: "US",
    url: input.url,
  };
  return schema;
}

export function faqSchema(
  faqs: { question: string; answer: string }[],
  url: string
) {
  const schema: WithContext<Record<string, unknown>> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
    url,
  };

  return schema;
}

export function jobPostingSchema(input: {
  title: string;
  description: string;
  datePosted: string;
  employmentType: string;
  hiringOrganization: {
    name: string;
    sameAs?: string;
  };
  jobLocation: {
    "@type": string;
    address: {
      "@type": string;
      addressLocality: string;
      addressRegion: string;
      addressCountry: string;
    };
  };
  baseSalary?: {
    "@type": string;
    currency: string;
    value: {
      "@type": string;
      minValue: number;
      maxValue: number;
      unitText: string;
    };
  };
  qualifications?: string;
  responsibilities?: string;
  workHours?: string;
  applicantLocationRequirements?: {
    "@type": string;
    address: {
      "@type": string;
      addressCountry: string;
    };
  };
  url: string;
}) {
  const schema: WithContext<Record<string, unknown>> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: input.title,
    description: input.description,
    identifier: {
      "@type": "PropertyValue",
      name: "Twin Mile LLC",
      value: `twinmile-${Date.now()}`,
    },
    datePosted: input.datePosted,
    validThrough: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
    employmentType: input.employmentType,
    hiringOrganization: {
      "@type": "Organization",
      name: input.hiringOrganization.name,
      sameAs: input.hiringOrganization.sameAs,
      logo: "https://twinmile.com/logo.png",
    },
    jobLocation: input.jobLocation,
    baseSalary: input.baseSalary,
    jobBenefits: [
      "80% Gross to Truck",
      "100% Fuel Surcharge",
      "Weekly Direct Deposit",
      "National Maintenance Network",
      "Fuel Advances",
      "ELD Included",
      "Fuel Discounts",
      "Power Only Focus (No Trailer Fees)",
    ],
    qualifications: input.qualifications,
    responsibilities: input.responsibilities,
    workHours: input.workHours || "Flexible schedule",
    applicantLocationRequirements: input.applicantLocationRequirements,
    occupationalCategory: "53-7032.00 - Heavy and Tractor-Trailer Truck Drivers",
    industry: "Truck Transportation",
    experienceRequirements: {
      "@type": "OccupationalExperienceRequirements",
      monthsOfExperience: 24, // 2 years minimum
    },
    educationRequirements: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "High School Diploma",
    },
    skills: [
      "Commercial Driving",
      "Time Management",
      "Safety Compliance",
      "Route Planning",
      "Vehicle Maintenance",
      "Customer Service",
    ],
    url: input.url,
    directApply: true,
  };

  return schema;
}

export function freightServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Freight Transportation Services",
    description: "Professional freight transportation services including local, regional, and long-haul shipping across the United States.",
    provider: {
      "@type": "Organization",
      name: "Twin Mile LLC",
      url: "https://twinmile.com",
    },
    areaServed: "US",
    serviceType: "Freight Transportation",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Freight Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Local Freight",
            description: "Local and regional freight transportation within Texas and surrounding states",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Long-Haul Freight",
            description: "Nationwide long-haul freight transportation services",
          },
        },
      ],
    },
    url: "https://twinmile.com/services",
  };
}

export function hotshotServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Hotshot Trucking Services",
    description: "Time-critical hotshot and expedited freight services for urgent shipments across Texas and nationwide.",
    provider: {
      "@type": "Organization",
      name: "Twin Mile LLC",
      url: "https://twinmile.com",
    },
    areaServed: "US",
    serviceType: "Hotshot Trucking",
    keywords: ["hotshot", "expedited", "time-critical", "urgent freight"],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Hotshot Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Expedited Hotshot",
            description: "Same-day and next-day hotshot delivery services",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Emergency Hotshot",
            description: "24/7 emergency hotshot services for critical shipments",
          },
        },
      ],
    },
    url: "https://twinmile.com/services",
  };
}

export function lastMileServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Last-Mile Delivery Services",
    description: "Professional last-mile delivery and courier services for businesses and e-commerce in Houston and surrounding areas.",
    provider: {
      "@type": "Organization",
      name: "Twin Mile LLC",
      url: "https://twinmile.com",
    },
    areaServed: ["Houston", "Texas", "Louisiana", "California"],
    serviceType: "Last-Mile Delivery",
    keywords: ["last mile", "courier", "delivery", "e-commerce"],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Delivery Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Business Delivery",
            description: "Scheduled delivery services for businesses",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "E-commerce Delivery",
            description: "Reliable e-commerce last-mile delivery solutions",
          },
        },
      ],
    },
    url: "https://twinmile.com/services",
  };
}

export function powerOnlyServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Power Only Trucking Services",
    description: "Specialized power only trucking services with no trailer fees. Perfect for owner-operators and fleet owners.",
    provider: {
      "@type": "Organization",
      name: "Twin Mile LLC",
      url: "https://twinmile.com",
    },
    areaServed: "US",
    serviceType: "Power Only Trucking",
    keywords: ["power only", "no trailer fees", "owner operator", "tractor only"],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Power Only Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Owner Operator Power Only",
            description: "Power only services for owner-operators with 80% gross pay",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Fleet Power Only",
            description: "Power only solutions for small and large fleets",
          },
        },
      ],
    },
    url: "https://twinmile.com/services",
  };
}

export function videoObjectSchema(input: {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration: string;
  contentUrl?: string;
  embedUrl?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: input.name,
    description: input.description,
    thumbnailUrl: input.thumbnailUrl,
    uploadDate: input.uploadDate,
    duration: input.duration,
    contentUrl: input.contentUrl,
    embedUrl: input.embedUrl,
    publisher: {
      "@type": "Organization",
      name: "Twin Mile LLC",
      logo: "https://twinmile.com/logo.png",
    },
    author: {
      "@type": "Organization",
      name: "Twin Mile LLC",
    },
    keywords: ["owner operator", "truck driving jobs", "power only", "Houston logistics"],
    potentialAction: {
      "@type": "WatchAction",
      target: input.embedUrl,
    },
  };
}

export function blogPostingSchema(input: {
  url: string;
  headline: string;
  description: string;
  datePublished: string;
  imageUrl?: string;
}) {
  const schema: WithContext<Record<string, unknown>> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.url,
    },
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    dateModified: input.datePublished,
    author: {
      "@type": "Organization",
      name: "Twin Mile LLC",
      url: "https://twinmile.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Twin Mile LLC",
      url: "https://twinmile.com",
    },
    ...(input.imageUrl
      ? {
          image: [input.imageUrl],
        }
      : {}),
    url: input.url,
  };

  return schema;
}
