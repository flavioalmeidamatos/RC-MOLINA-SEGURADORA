/**
 * Valida um e-mail com regex inspirada na RFC 5322.
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
  return msg;
};

const somenteDigitos = (valor: string): string => valor.replace(/\D/g, '');

export const formatarCPF = (valor: string): string => {
  const digitos = somenteDigitos(valor).slice(0, 11);
  return digitos
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

export const validarCPF = (valor: string): boolean => {
  const cpf = somenteDigitos(valor);

  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
    return false;
  }

  let soma = 0;
  for (let i = 0; i < 9; i += 1) {
    soma += Number(cpf.charAt(i)) * (10 - i);
  }

  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(cpf.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i += 1) {
    soma += Number(cpf.charAt(i)) * (11 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;

  return resto === Number(cpf.charAt(10));
};

export const formatarRG = (valor: string): string => {
  const caracteres = valor.toUpperCase().replace(/[^0-9X]/g, '').split('');
  const base: string[] = [];
  let verificador = '';

  for (const caractere of caracteres) {
    if (base.length < 8 && /\d/.test(caractere)) {
      base.push(caractere);
      continue;
    }

    if (base.length === 8 && /[\dX]/.test(caractere)) {
      verificador = caractere;
      break;
    }
  }

  const numero = base.join('');
  return verificador ? `${numero}-${verificador}` : numero;
};

export const validarRG = (valor: string): boolean => {
  const rg = valor.toUpperCase().replace(/[^0-9X]/g, '');
  const base = rg.slice(0, 8);
  const digitoInformado = rg.slice(8);

  if (!/^\d{8}$/.test(base) || !/^[0-9X]$/.test(digitoInformado) || /^(\d)\1+$/.test(base)) {
    return false;
  }

  const soma = base
    .split('')
    .reduce((acc, numero, index) => acc + Number(numero) * (9 - index), 0);
  const resto = soma % 11;
  const digitoCalculado = resto === 10 ? 'X' : String(resto);

  return digitoInformado === digitoCalculado;
};

export const formatarCNPJ = (valor: string): string => {
  const digitos = somenteDigitos(valor).slice(0, 14);
  return digitos
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

export const validarCNPJ = (valor: string): boolean => {
  const cnpj = somenteDigitos(valor);

  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
    return false;
  }

  const calcularDigito = (base: string, pesos: number[]) => {
    const soma = base
      .split('')
      .reduce((acc, numero, index) => acc + Number(numero) * pesos[index], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base = cnpj.slice(0, 12);
  const digito1 = calcularDigito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digito2 = calcularDigito(`${base}${digito1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return cnpj === `${base}${digito1}${digito2}`;
};

export const formatarDataBR = (valor: string): string => {
  const digitos = somenteDigitos(valor).slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
};

export const validarDataNascimentoBR = (valor: string): boolean => {
  const match = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;

  const dia = Number(match[1]);
  const mes = Number(match[2]);
  const ano = Number(match[3]);

  if (mes < 1 || mes > 12 || ano < 1900) return false;

  const data = new Date(ano, mes - 1, dia);
  const hoje = new Date();

  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return false;
  }

  if (data > hoje) return false;

  const idade = hoje.getFullYear() - ano;
  return idade <= 130;
};
