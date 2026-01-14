type WithContext<T> = T & { "@context": "https://schema.org" };

export function orgSchema() {
  const schema: WithContext<Record<string, unknown>> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Twin Mile LLC",
    url: "https://twinmile.com",
    slogan: "Fast. Tough. Reliable.",
  };
  return schema;
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
    address: {
      "@type": "PostalAddress",
      addressLocality: "Houston",
      addressRegion: "TX",
      addressCountry: "US",
    },
    areaServed: "US",
  };
  return schema;
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
