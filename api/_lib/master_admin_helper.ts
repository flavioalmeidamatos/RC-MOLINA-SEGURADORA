export const MASTER_EMAILS = [
  'admin@rcmolina.com.br',
  'matos.almeida.flavio@gmail.com'
];

export const isMasterAdmin = (user: { email?: string; is_master_admin?: boolean } | null | undefined): boolean => {
  if (!user) return false;
  if (user.is_master_admin === true) return true;
  if (user.email && MASTER_EMAILS.includes(user.email.toLowerCase().trim())) return true;
  return false;
};
