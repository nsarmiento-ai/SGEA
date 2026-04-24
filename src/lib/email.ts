
export interface EmailConfig {
  to: string;
  cc?: string;
  subject: string;
  body: string;
}

export const generateMailtoLink = (config: EmailConfig) => {
  const { to, cc, subject, body } = config;
  const params = new URLSearchParams();
  if (cc) params.append('cc', cc);
  params.append('subject', subject);
  params.append('body', body);
  
  return `mailto:${to}?${params.toString().replace(/\+/g, '%20')}`;
};

export const sendAssistedEmail = (config: EmailConfig) => {
  const link = generateMailtoLink(config);
  window.open(link, '_blank');
};
