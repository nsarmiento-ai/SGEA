
export interface EmailConfig {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}

export const generateMailtoLink = (config: EmailConfig) => {
  const { to, cc, subject, body } = config;
  let link = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (cc) {
    link += `&cc=${encodeURIComponent(cc)}`;
  }
  return link;
};

export const sendAssistedEmail = (config: EmailConfig) => {
  const link = generateMailtoLink(config);
  window.location.href = link;
};
