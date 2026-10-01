const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    PermissionFlagsBits,
    Routes,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    REST
} = require("discord.js");

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

app.use(express.json());

/* =========================================================
   CONFIGURAÇÕES
========================================================= */

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const ROBLOX_CLIENT_ID = process.env.ROBLOX_CLIENT_ID;
const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET;

const ROBLOX_REDIRECT_URI =
    process.env.ROBLOX_REDIRECT_URI ||
    "https://eb-discord.onrender.com/callback";

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

const ROBLOX_UNIVERSE_ID = "9875022038";

const ROBLOX_DATASTORE = "EB_SISTEMA_V1";

const PORT = process.env.PORT || 10000;

/* =========================================================
   CLIENT DISCORD
========================================================= */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

/* =========================================================
   PATENTES
========================================================= */

const PATENTES = [
    "Civil",
    "Recruta",
    "Soldado",
    "Cabo",
    "3º Sargento",
    "2º Sargento",
    "1º Sargento",
    "Subtenente",
    "Cadete",
    "Aspirante a Oficial",
    "2º Tenente",
    "1º Tenente",
    "Capitão",
    "Major",
    "Tenente-Coronel",
    "Coronel",
    "General de Brigada",
    "General de Divisão",
    "General de Exército",
    "Elite Militar",
    "Elite Secreta",
    "Elite Real",
    "Subcomandante",
    "Comandante"
];

/* =========================================================
   SIGLAS DAS PATENTES
========================================================= */

const SIGLAS_PATENTES = {
    "Civil": "CV",
    "Recruta": "REC",
    "Soldado": "SLD",
    "Cabo": "CB",
    "3º Sargento": "3SGT",
    "2º Sargento": "2SGT",
    "1º Sargento": "1SGT",
    "Subtenente": "SBT",
    "Cadete": "CD",
    "Aspirante a Oficial": "AAO",
    "2º Tenente": "2TEN",
    "1º Tenente": "1TEN",
    "Capitão": "CAP",
    "Major": "MAJ",
    "Tenente-Coronel": "TCEL",
    "Coronel": "CEL",
    "General de Brigada": "GDB",
    "General de Divisão": "GDD",
    "General de Exército": "GDE",
    "Elite Militar": "EM",
    "Elite Secreta": "ES",
    "Elite Real": "ER",
    "Subcomandante": "SUBCMT",
    "Comandante": "CMT"
};

/* =========================================================
   NORMALIZAR TEXTO
========================================================= */

function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/* =========================================================
   OBTER PATENTE
========================================================= */

function obterPatente(dados) {
    if (!dados) {
        return "Civil";
    }

    if (typeof dados === "string") {
        return dados;
    }

    return (
        dados.Patente ||
        dados.patente ||
        dados.Rank ||
        dados.rank ||
        "Civil"
    );
}

/* =========================================================
   OBTER DIVISÃO
========================================================= */

function obterDivisao(dados) {
    if (!dados) {
        return "Civis";
    }

    if (typeof dados === "string") {
        return "Civis";
    }

    return (
        dados.Divisao ||
        dados.divisao ||
        dados.Division ||
        dados.division ||
        "Civis"
    );
}

/* =========================================================
   OBTER CARGO DA DIVISÃO
========================================================= */

function obterCargoDivisao(dados) {
    if (!dados || typeof dados === "string") {
        return "";
    }

    return (
        dados.CargoDivisao ||
        dados.cargoDivisao ||
        dados.CargoCIE ||
        dados.CargoBIP ||
        dados.CargoBAC ||
        ""
    );
}

/* =========================================================
   ROBLOX DATASTORE
========================================================= */

async function buscarDadosRoblox(userId) {
    try {
        const url =
            `https://apis.roblox.com/cloud/v2/universes/` +
            `${ROBLOX_UNIVERSE_ID}/data-stores/` +
            `${encodeURIComponent(ROBLOX_DATASTORE)}/entries/` +
            `${encodeURIComponent(String(userId))}`;

        console.log("");
        console.log("[ROBLOX DATASTORE]");
        console.log("Consultando:", url);

        const resposta = await axios.get(url, {
            headers: {
                "x-api-key": ROBLOX_API_KEY
            },
            validateStatus: () => true
        });

        console.log("Status:", resposta.status);

        if (resposta.status !== 200) {
            console.log("Resposta:", resposta.data);
            return null;
        }

        return resposta.data;
    } catch (erro) {
        console.log(
            "[ROBLOX DATASTORE] Erro:",
            erro.response?.data || erro.message
        );

        return null;
    }
}

/* =========================================================
   ENCONTRAR SERVIDOR DO USUÁRIO
========================================================= */

async function encontrarServidorDoUsuario(discordId) {
    for (const guild of client.guilds.cache.values()) {
        try {
            const member = await guild.members.fetch(discordId);

            if (member) {
                return {
                    guild,
                    member
                };
            }
        } catch (erro) {
            // Usuário não está neste servidor
        }
    }

    return null;
}

/* =========================================================
   ALTERAR NICKNAME
========================================================= */

async function alterarNickname(
    guild,
    member,
    robloxUsername,
    patente
) {
    try {
        if (!guild || !member) {
            return false;
        }

        /*
            O dono do servidor não pode ter o nickname
            alterado pelo bot.
        */

        if (member.id === guild.ownerId) {
            console.log(
                "[NICKNAME] Usuário é o dono do servidor."
            );

            return false;
        }

        /*
            Verifica permissão do bot
        */

        const botMember = guild.members.me;

        if (!botMember) {
            console.log(
                "[NICKNAME] Não consegui encontrar o bot."
            );

            return false;
        }

        if (!botMember.permissions.has(
            PermissionFlagsBits.ManageNicknames
        )) {
            console.log(
                "[NICKNAME] Bot não possui Manage Nicknames."
            );

            return false;
        }

        /*
            Verifica hierarquia
        */

        if (
            member.roles.highest.position >=
            botMember.roles.highest.position
        ) {
            console.log(
                "[NICKNAME] O cargo do usuário está acima ou igual ao bot."
            );

            return false;
        }

        /*
            Descobre a sigla
        */

        const sigla =
            SIGLAS_PATENTES[patente] || "CV";

        /*
            FORMATO FINAL:

            [CV]Joao123
            [AAO]Joao123
            [GDE]Joao123
        */

        const novoNickname =
            `[${sigla}]${robloxUsername}`;

        await member.setNickname(
            novoNickname,
            "Verificação da conta Roblox"
        );

        console.log(
            "[NICKNAME] Alterado para:",
            novoNickname
        );

        return true;

    } catch (erro) {
        console.log(
            "[NICKNAME] Erro:",
            erro.message
        );

        return false;
    }
}

/* =========================================================
   APLICAR CARGO DA PATENTE
========================================================= */

async function aplicarPatente(
    guild,
    member,
    patente
) {
    try {
        if (!guild || !member) {
            return false;
        }

        const nomePatenteNormalizado =
            normalizarTexto(patente);

        /*
            Procura o cargo da patente
        */

        const cargoPatente =
            guild.roles.cache.find(
                role =>
                    normalizarTexto(role.name) ===
                    nomePatenteNormalizado
            );

        if (!cargoPatente) {
            console.log(
                "[CARGO] Cargo da patente não encontrado:",
                patente
            );

            return false;
        }

        const botMember = guild.members.me;

        if (!botMember) {
            return false;
        }

        /*
            Verifica hierarquia
        */

        if (
            cargoPatente.position >=
            botMember.roles.highest.position
        ) {
            console.log(
                "[CARGO] Cargo está acima do bot:",
                cargoPatente.name
            );

            return false;
        }

        /*
            Remove cargos antigos de patente
        */

        for (const cargo of guild.roles.cache.values()) {
            const nomeNormalizado =
                normalizarTexto(cargo.name);

            const ehPatente =
                PATENTES.some(
                    p =>
                        normalizarTexto(p) ===
                        nomeNormalizado
                );

            if (
                ehPatente &&
                member.roles.cache.has(cargo.id)
            ) {
                if (
                    cargo.id !== cargoPatente.id &&
                    cargo.position <
                        botMember.roles.highest.position
                ) {
                    try {
                        await member.roles.remove(
                            cargo,
                            "Atualização da patente Roblox"
                        );
                    } catch (erro) {
                        console.log(
                            "[CARGO] Não consegui remover:",
                            cargo.name
                        );
                    }
                }
            }
        }

        /*
            Adiciona cargo correto
        */

        if (!member.roles.cache.has(cargoPatente.id)) {
            await member.roles.add(
                cargoPatente,
                "Patente obtida do Roblox"
            );
        }

        console.log(
            "[CARGO] Patente aplicada:",
            cargoPatente.name
        );

        return true;

    } catch (erro) {
        console.log(
            "[CARGO] Erro:",
            erro.message
        );

        return false;
    }
}

/* =========================================================
   OAUTH
========================================================= */

const estadosOAuth = new Map();

/* =========================================================
   GERAR STATE
========================================================= */

function gerarState() {
    return crypto.randomBytes(32).toString("hex");
}

/* =========================================================
   GERAR PKCE
========================================================= */

function gerarCodeVerifier() {
    return crypto
        .randomBytes(64)
        .toString("base64url");
}

function gerarCodeChallenge(verifier) {
    return crypto
        .createHash("sha256")
        .update(verifier)
        .digest("base64url");
}

/* =========================================================
   ROTA AUTH
========================================================= */

app.get("/auth", (req, res) => {
    try {
        const discordId = req.query.discord;

        if (!discordId) {
            return res.status(400).send(
                "Discord não informado."
            );
        }

        const state = gerarState();
        const codeVerifier = gerarCodeVerifier();
        const codeChallenge =
            gerarCodeChallenge(codeVerifier);

        estadosOAuth.set(state, {
            discordId,
            codeVerifier,
            criadoEm: Date.now()
        });

        const parametros = new URLSearchParams({
            client_id: ROBLOX_CLIENT_ID,
            redirect_uri: ROBLOX_REDIRECT_URI,
            response_type: "code",
            scope: "openid profile",
            state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256"
        });

        const url =
            "https://apis.roblox.com/oauth/v1/authorize?" +
            parametros.toString();

        res.redirect(url);

    } catch (erro) {
        console.log(
            "[AUTH] Erro:",
            erro.message
        );

        res.status(500).send(
            "Erro ao iniciar autenticação."
        );
    }
});

/* =========================================================
   CALLBACK
========================================================= */

app.get("/callback", async (req, res) => {
    try {
        const {
            code,
            state,
            error,
            error_description
        } = req.query;

        if (error) {
            return res.status(400).send(
                `Erro Roblox: ${error_description || error}`
            );
        }

        if (!code || !state) {
            return res.status(400).send(
                "Código ou state não informado."
            );
        }

        const dadosState =
            estadosOAuth.get(state);

        if (!dadosState) {
            return res.status(400).send(
                "Sessão de autenticação inválida ou expirada."
            );
        }

        estadosOAuth.delete(state);

        /*
            Trocar code pelo token
        */

        const tokenResposta =
            await axios.post(
                "https://apis.roblox.com/oauth/v1/token",
                new URLSearchParams({
                    grant_type: "authorization_code",
                    code,
                    client_id: ROBLOX_CLIENT_ID,
                    client_secret: ROBLOX_CLIENT_SECRET,
                    redirect_uri: ROBLOX_REDIRECT_URI,
                    code_verifier: dadosState.codeVerifier
                }).toString(),
                {
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    }
                }
            );

        const accessToken =
            tokenResposta.data.access_token;

        if (!accessToken) {
            return res.status(400).send(
                "Roblox não retornou o access token."
            );
        }

        /*
            Buscar usuário Roblox
        */

        const userResposta =
            await axios.get(
                "https://apis.roblox.com/oauth/v1/userinfo",
                {
                    headers: {
                        Authorization:
                            `Bearer ${accessToken}`
                    }
                }
            );

        const robloxUser =
            userResposta.data;

        const robloxUsername =
            robloxUser.preferred_username ||
            robloxUser.name ||
            robloxUser.nickname;

        const robloxUserId =
            robloxUser.sub;

        console.log("");
        console.log(
            "[ROBLOX OAUTH]",
            robloxUsername,
            robloxUserId
        );

        if (!robloxUsername || !robloxUserId) {
            return res.status(400).send(
                "Não foi possível identificar sua conta Roblox."
            );
        }

        /*
            Encontrar usuário no Discord
        */

        const resultadoDiscord =
            await encontrarServidorDoUsuario(
                dadosState.discordId
            );

        if (!resultadoDiscord) {
            return res.status(400).send(
                "Você não está em nenhum servidor onde o bot esteja."
            );
        }

        const {
            guild,
            member
        } = resultadoDiscord;

        /*
            Buscar DataStore
        */

        const dadosRoblox =
            await buscarDadosRoblox(
                robloxUserId
            );

        if (!dadosRoblox) {
            return res.status(404).send(
                `
                <h2>⚠️ Dados não encontrados</h2>
                <p>Sua conta Roblox foi encontrada, mas não existe registro no DataStore.</p>
                <p><b>DataStore:</b> ${ROBLOX_DATASTORE}</p>
                <p><b>UserId:</b> ${robloxUserId}</p>
                `
            );
        }

        /*
            Obter patente
        */

        const patente =
            obterPatente(dadosRoblox);

        const divisao =
            obterDivisao(dadosRoblox);

        const cargoDivisao =
            obterCargoDivisao(dadosRoblox);

        console.log("");
        console.log(
            "[DADOS ROBLOX]"
        );

        console.log(
            "Nome:",
            robloxUsername
        );

        console.log(
            "UserId:",
            robloxUserId
        );

        console.log(
            "Patente:",
            patente
        );

        console.log(
            "Divisão:",
            divisao
        );

        console.log(
            "Cargo:",
            cargoDivisao
        );

        /*
            ALTERAR NICKNAME

            Exemplo:

            [CV]Joao123
            [AAO]Joao123
            [GDE]Joao123
        */

        const nicknameAlterado =
            await alterarNickname(
                guild,
                member,
                robloxUsername,
                patente
            );

        /*
            Aplicar patente
        */

        const patenteAplicada =
            await aplicarPatente(
                guild,
                member,
                patente
            );

        /*
            Remover Não verificado
        */

        const cargoNaoVerificado =
            guild.roles.cache.find(
                role =>
                    normalizarTexto(role.name) ===
                    normalizarTexto("Não verificado")
            );

        if (cargoNaoVerificado) {
            try {
                if (
                    member.roles.cache.has(
                        cargoNaoVerificado.id
                    )
                ) {
                    await member.roles.remove(
                        cargoNaoVerificado,
                        "Conta Roblox verificada"
                    );
                }
            } catch (erro) {
                console.log(
                    "[VERIFICAÇÃO] Não consegui remover Não verificado:",
                    erro.message
                );
            }
        }

        /*
            Resultado
        */

        let resultado = `
            <h1>✅ Verificação concluída!</h1>

            <p><b>Roblox:</b> ${robloxUsername}</p>

            <p><b>Patente:</b> ${patente}</p>

            <p><b>Nickname:</b> [${SIGLAS_PATENTES[patente] || "CV"}]${robloxUsername}</p>

            <p><b>Divisão:</b> ${divisao}</p>
        `;

        if (!nicknameAlterado) {
            resultado += `
                <p>⚠️ O nickname não pôde ser alterado pelo bot.</p>
            `;
        }

        if (!patenteAplicada) {
            resultado += `
                <p>⚠️ O cargo da patente não pôde ser aplicado.</p>
            `;
        }

        resultado += `
            <p>Você já pode voltar para o Discord.</p>
        `;

        res.send(resultado);

    } catch (erro) {
        console.log("");
        console.log(
            "[CALLBACK] ERRO:"
        );

        console.log(
            erro.response?.data ||
            erro.message
        );

        res.status(500).send(
            `
            <h2>❌ Erro ao concluir a verificação.</h2>
            <p>${erro.response?.data?.message || erro.message}</p>
            `
        );
    }
});

/* =========================================================
   PAINEL DE VERIFICAÇÃO
========================================================= */

const comandos = [

    new SlashCommandBuilder()
        .setName("painelverificar")
        .setDescription(
            "Envia o painel para vincular sua conta Roblox."
        ),

    new SlashCommandBuilder()
        .setName("tiracargo")
        .setDescription(
            "Remove um cargo de um usuário. Uso exclusivo CGEX."
        )
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription(
                    "Usuário que terá o cargo removido."
                )
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName("cargo")
                .setDescription(
                    "Cargo que será removido."
                )
                .setRequired(true)
        )
];

comandos.forEach(
    comando => comando.toJSON()
);

/* =========================================================
   BOT ONLINE
========================================================= */

client.once("ready", async () => {

    console.log("");
    console.log("==============================");
    console.log("      EB DISCORD ONLINE");
    console.log("==============================");

    console.log(
        "Bot:",
        client.user.tag
    );

    console.log(
        "ID:",
        client.user.id
    );

    /*
        Registrar comandos globalmente.

        IMPORTANTE:
        Não usamos DISCORD_CLIENT_ID.
        Pegamos o ID diretamente do bot.
    */

    try {

        const rest =
            new REST({
                version: "10"
            }).setToken(
                DISCORD_TOKEN
            );

        const applicationId =
            client.user.id;

        await rest.put(
            Routes.applicationCommands(
                applicationId
            ),
            {
                body: comandos.map(
                    comando => comando.toJSON()
                )
            }
        );

        console.log(
            "Comandos registrados globalmente."
        );

    } catch (erro) {

        console.log(
            "Erro ao registrar comandos:"
        );

        console.log(
            erro
        );
    }
});

/* =========================================================
   INTERAÇÕES
========================================================= */

client.on(
    "interactionCreate",
    async interaction => {

        try {

            /*
                PAINEL VERIFICAR
            */

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                    "painelverificar"
            ) {

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "🇧🇷 Verificação EB"
                        )
                        .setDescription(
                            [
                                "Para acessar o servidor,",
                                "você precisa vincular sua",
                                "conta Roblox.",
                                "",
                                "Clique no botão abaixo",
                                "para iniciar a verificação."
                            ].join("\n")
                        );

                const botao =
                    new ButtonBuilder()
                        .setCustomId(
                            "vincular_roblox"
                        )
                        .setLabel(
                            "Vincular Roblox"
                        )
                        .setStyle(
                            ButtonStyle.Primary
                        );

                const linha =
                    new ActionRowBuilder()
                        .addComponents(
                            botao
                        );

                await interaction.reply({
                    embeds: [embed],
                    components: [linha]
                });

                return;
            }

            /*
                BOTÃO VINCULAR ROBLOX
            */

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "vincular_roblox"
            ) {

                const url =
                    `${ROBLOX_REDIRECT_URI
                        .replace(
                            "/callback",
                            "/auth"
                        )}` +
                    `?discord=${interaction.user.id}`;

                await interaction.reply({
                    content:
                        "🔗 Clique abaixo para vincular sua conta Roblox:\n\n" +
                        url,
                    ephemeral: true
                });

                return;
            }

            /*
                TIRAR CARGO
            */

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                    "tiracargo"
            ) {

                /*
                    Verifica se o usuário possui
                    o cargo CGEX
                */

                const cargoCGEX =
                    interaction.guild.roles.cache.find(
                        role =>
                            normalizarTexto(
                                role.name
                            ) ===
                            normalizarTexto(
                                "CGEX"
                            )
                    );

                if (
                    !cargoCGEX ||
                    !interaction.member.roles.cache.has(
                        cargoCGEX.id
                    )
                ) {
                    await interaction.reply({
                        content:
                            "❌ Apenas membros da CGEX podem usar este comando.",
                        ephemeral: true
                    });

                    return;
                }

                const usuario =
                    interaction.options.getMember(
                        "usuario"
                    );

                const cargo =
                    interaction.options.getRole(
                        "cargo"
                    );

                if (!usuario || !cargo) {
                    await interaction.reply({
                        content:
                            "❌ Usuário ou cargo inválido.",
                        ephemeral: true
                    });

                    return;
                }

                try {

                    await usuario.roles.remove(
                        cargo,
                        `Cargo removido por ${interaction.user.tag}`
                    );

                    await interaction.reply({
                        content:
                            `✅ O cargo **${cargo.name}** foi removido de ${usuario}.`,
                        ephemeral: true
                    });

                } catch (erro) {

                    console.log(
                        "[TIRACARGO]",
                        erro.message
                    );

                    await interaction.reply({
                        content:
                            "❌ Não consegui remover esse cargo. Verifique a hierarquia do bot.",
                        ephemeral: true
                    });
                }

                return;
            }

        } catch (erro) {

            console.log(
                "[INTERACTION] Erro:",
                erro.message
            );

            try {

                if (!interaction.replied) {

                    await interaction.reply({
                        content:
                            "❌ Ocorreu um erro.",
                        ephemeral: true
                    });

                }

            } catch (erro2) {}
        }
    }
);

/* =========================================================
   NOVO MEMBRO
========================================================= */

client.on(
    "guildMemberAdd",
    async member => {

        try {

            const cargo =
                member.guild.roles.cache.find(
                    role =>
                        normalizarTexto(
                            role.name
                        ) ===
                        normalizarTexto(
                            "Não verificado"
                        )
                );

            if (!cargo) {
                console.log(
                    "[ENTRADA] Cargo Não verificado não encontrado."
                );

                return;
            }

            await member.roles.add(
                cargo,
                "Novo membro"
            );

            console.log(
                "[ENTRADA] Não verificado aplicado:",
                member.user.tag
            );

        } catch (erro) {

            console.log(
                "[ENTRADA] Erro:",
                erro.message
            );
        }
    }
);

/* =========================================================
   LIMPEZA DE STATES
========================================================= */

setInterval(() => {

    const agora = Date.now();

    for (
        const [
            state,
            dados
        ] of estadosOAuth
    ) {

        if (
            agora - dados.criadoEm >
            10 * 60 * 1000
        ) {

            estadosOAuth.delete(
                state
            );
        }
    }

}, 5 * 60 * 1000);

/* =========================================================
   SERVIDOR WEB
========================================================= */

app.get("/", (req, res) => {

    res.send(
        "🇧🇷 EB Discord Bot Online!"
    );

});

app.listen(
    PORT,
    () => {

        console.log(
            `Servidor web rodando na porta ${PORT}`
        );

    }
);

/* =========================================================
   LOGIN DISCORD
========================================================= */

if (!DISCORD_TOKEN) {

    console.log(
        "❌ DISCORD_TOKEN não configurado."
    );

} else {

    client.login(
        DISCORD_TOKEN
    );
}
