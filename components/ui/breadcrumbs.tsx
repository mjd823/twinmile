import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={`flex items-center space-x-1 text-sm text-muted-foreground ${className}`}
    >
      <Link 
        href="/" 
        className="hover:text-foreground transition-colors"
        aria-label="Home"
      >
        Home
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-1">
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
          {item.href ? (
            <Link 
              href={item.href} 
              className="hover:text-foreground transition-colors"
              aria-current={index === items.length - 1 ? "page" : undefined}
            >
              {item.label}
            </Link>
          ) : (
            <span 
              className="text-foreground font-medium"
              aria-current="page"
            >
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}

// Breadcrumb schemas for SEO
export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  const breadcrumbList = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://twinmile.com"
    },
    ...items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 2,
      "name": item.label,
      "item": item.href ? `https://twinmile.com${item.href}` : undefined
    }))
  ];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbList
  };
}
