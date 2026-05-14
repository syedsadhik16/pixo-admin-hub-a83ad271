import { Helmet } from "react-helmet-async";

interface PageHeadProps {
  title: string;
  description?: string;
  canonical?: string;
}

/**
 * Per-route head tags: title, description, canonical, og:* mirrors.
 * Use a relative `canonical` path (e.g. "/admin/login") — resolved at request time.
 */
export function PageHead({ title, description, canonical }: PageHeadProps) {
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {canonical && <link rel="canonical" href={canonical} />}
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:type" content="website" />
    </Helmet>
  );
}
