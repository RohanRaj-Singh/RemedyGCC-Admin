export interface TenantContentText {
  en?: string;
  ar?: string;
}

export interface TenantPageContentConfig {
  about?: {
    intro?: TenantContentText;
  };
}

export interface TenantContentConfig {
  pages?: TenantPageContentConfig;
}

export function normalizeTenantContentText(
  value: TenantContentText | null | undefined,
): TenantContentText | undefined {
  if (!value) {
    return undefined;
  }

  const normalized: TenantContentText = {
    en: value.en?.trim() || undefined,
    ar: value.ar?.trim() || undefined,
  };

  if (!normalized.en && !normalized.ar) {
    return undefined;
  }

  return normalized;
}

export function normalizeTenantContentConfig(
  content: TenantContentConfig | null | undefined,
): TenantContentConfig {
  const aboutIntro = normalizeTenantContentText(content?.pages?.about?.intro);

  if (!aboutIntro) {
    return {};
  }

  return {
    pages: {
      about: {
        intro: aboutIntro,
      },
    },
  };
}
