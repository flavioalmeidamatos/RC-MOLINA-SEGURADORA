import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jswaergqcrrgajudvzts.supabase.co'
const supabaseKey = 'sb_publishable_lz-33jMEyQvBhGXKsh3Cfg_wBJ2VTIT'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testOtp() {
    console.log("Iniciando teste de envio de OTP (6 dígitos) para matos.almeida.flavio@gmail.com...");

    const startTime = Date.now();
    const { data, error } = await supabase.auth.signInWithOtp({
        email: 'matos.almeida.flavio@gmail.com',
        options: {
            shouldCreateUser: false
        }
    })

    const duration = Date.now() - startTime;

    if (error) {
        console.error(`\n[FALHA] Tempo de resposta: ${duration}ms`);
        console.error("-> Status do Erro (HTTP):", error.status);
        console.error("-> Mensagem do Servidor Supabase:", error.message);

        if (error.status === 429) {
            console.log("\n⚠️ CONCLUSÃO: O Limite de Taxa (Rate Limit) do plano grátis foi de fato atingido.");
            console.log("O provedor de e-mail integrado do Supabase limita envios a 3-4 e-mails por hora no plano livre para combater SPAM.");
        } else if (error.status === 400 && error.message.includes('Signups not allowed')) {
            console.log("\n⚠️ CONCLUSÃO: E-mail inexistente no banco, ou bloqueado nas configurações de SignUp.");
        }
    } else {
        console.log(`\n[SUCESSO] Tempo de resposta: ${duration}ms`);
        console.log("-> O Supabase processou com status 200 OK. Nenhum bloqueio de taxa limitador ativo no momento.");
        console.log("Se não chegou, a barreira muito provavelmente é de Filtro de SPAM na caixa do Gmail.");
    }
}

testOtp()
