/**
 * Validates an email address using a regex that follows RFC 5322.
 */
export const validarEmailRFC5322 = (email: string): boolean => {
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email);
};

export const traduzirErroSupabase = (msg: string): string => {
  if (!msg) return 'Ocorreu um erro desconhecido.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('user already registered')) return 'Este usuário já está cadastrado. Faça o login.';
  if (m.includes('password should be different from the old password')) return 'A nova senha deve ser diferente da senha antiga.';
  if (m.includes('email not confirmed')) return 'Por favor, confirme seu e-mail antes de acessar.';
  if (m.includes('weak password') || m.includes('password should be at least')) return 'A senha é muito fraca ou menor que 8 caracteres.';
  if (m.includes('rate limit')) return 'Muitas tentativas. Aguarde um instante e tente novamente.';
  return msg; // Retorna original caso não mapeado
};
