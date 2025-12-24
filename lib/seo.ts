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
