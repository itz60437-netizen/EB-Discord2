const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    PermissionFlagsBits,
    Routes,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");

const { REST } = require("@discordjs/rest");
const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const PORT = process.env.PORT || 3000;

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

const NOME_CARGO_NAO_VERIFICADO = "Não verificado";

// ======================================================
// ROBLOX OAUTH
// ======================================================

const ROBLOX_CLIENT_ID = process.env.ROBLOX_CLIENT_ID;
const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET;

const ROBLOX_REDIRECT_URI =
    process.env.ROBLOX_REDIRECT_URI ||
    "https://eb-discord.onrender.com/callback";

// ======================================================
// ROBLOX OPEN CLOUD
// ======================================================

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

const ROBLOX_UNIVERSE_ID = "9875022038";

const ROBLOX_DATASTORE = "EB_SISTEMA_V1";

const ROBLOX_CLOUD_BASE =
    "https://apis.roblox.com/cloud/v2";

// ======================================================
// EXPRESS
// ======================================================

const app = express();

app.use(express.json());

app.get("/", (req, res) => {

    res.send(`
        <html>

        <head>
            <meta charset="UTF-8">
            <title>EB Discord</title>
        </head>

        <body style="
            background:#111;
            color:white;
            font-family:Arial;
            text-align:center;
            padding-top:80px;
        ">

            <h1>🇧🇷 EB Discord Online</h1>

            <p>Sistema funcionando.</p>

        </body>

        </html>
    `);

});

// ======================================================
// SESSÕES OAUTH
// ======================================================

const sessoesOAuth = new Map();

function gerarState() {

    return crypto
        .randomBytes(32)
        .toString("hex");

}

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

// ======================================================
// DATASTORE ROBLOX
// ======================================================

async function buscarDadosRoblox(userId) {

    if (!ROBLOX_API_KEY) {

        throw new Error(
            "ROBLOX_API_KEY não configurada no Render."
        );

    }

    const chave =
        encodeURIComponent(
            String(userId)
        );

    const url =
        `${ROBLOX_CLOUD_BASE}` +
        `universes/${ROBLOX_UNIVERSE_ID}` +
        `/data-stores/${encodeURIComponent(ROBLOX_DATASTORE)}` +
        `/entries/${chave}`;

    console.log(
        "[ROBLOX DATASTORE] Consultando:",
        url
    );

    const resposta =
        await axios.get(
            url,
            {
                headers: {
                    "x-api-key":
                        ROBLOX_API_KEY
                },

                validateStatus:
                    () => true
            }
        );

    console.log(
        "[ROBLOX DATASTORE] Status:",
        resposta.status
    );

    if (resposta.status === 404) {

        return null;

    }

    if (
        resposta.status === 401 ||
        resposta.status === 403
    ) {

        throw new Error(
            "Roblox recusou a API Key. " +
            "Verifique as permissões do DataStore."
        );

    }

    if (resposta.status >= 400) {

        throw new Error(
            `Roblox DataStore retornou HTTP ${resposta.status}: ` +
            JSON.stringify(resposta.data)
        );

    }

    let valor =
        resposta.data?.value;

    if (
        typeof valor === "string"
    ) {

        try {

            valor =
                JSON.parse(valor);

        } catch (erro) {

            console.log(
                "[ROBLOX DATASTORE] Valor não é JSON."
            );

        }

    }

    if (
        !valor ||
        typeof valor !== "object"
    ) {

        return null;

    }

    return valor;

}

// ======================================================
// PEGAR PATENTE
// ======================================================

function obterPatente(dados) {

    if (!dados) {

        return "Civil";

    }

    return (
        dados.Patente ||
        dados.patente ||
        dados.Rank ||
        dados.rank ||
        "Civil"
    );

}

// ======================================================
// PEGAR DIVISÃO
// ======================================================

function obterDivisao(dados) {

    if (!dados) {

        return "Civil";

    }

    return (
        dados.Divisao ||
        dados.divisao ||
        dados.Division ||
        dados.division ||
        "Civil"
    );

}

// ======================================================
// PEGAR CARGO DA DIVISÃO
// ======================================================

function obterCargoDivisao(dados) {

    if (!dados) {

        return "";

    }

    return (
        dados.CargoDivisao ||
        dados.cargoDivisao ||
        dados.CargoCIE ||
        dados.cargoCIE ||
        dados.Cargo ||
        dados.cargo ||
        ""
    );

}

// ======================================================
// NORMALIZAR
// ======================================================

function normalizar(texto) {

    return String(texto || "")
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .toLowerCase()
        .trim();

}

// ======================================================
// PATENTES
// ======================================================

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

// ======================================================
// ENCONTRAR CARGO
// ======================================================

function encontrarCargo(
    guild,
    nome
) {

    const normalizado =
        normalizar(nome);

    return guild.roles.cache.find(
        role =>
            normalizar(role.name) ===
            normalizado
    );

}

// ======================================================
// APLICAR PATENTE
// ======================================================

async function aplicarPatente(
    guild,
    member,
    patente
) {

    const cargo =
        encontrarCargo(
            guild,
            patente
        );

    if (!cargo) {

        console.log(
            `[CARGO] Cargo "${patente}" não existe.`
        );

        return {

            sucesso: false,

            mensagem:
                `O cargo **${patente}** não existe no servidor.`

        };

    }

    const botMember =
        guild.members.me;

    if (!botMember) {

        return {

            sucesso: false,

            mensagem:
                "Não consegui localizar o próprio bot."

        };

    }

    if (
        cargo.position >=
        botMember.roles.highest.position
    ) {

        return {

            sucesso: false,

            mensagem:
                `Não consigo colocar o cargo **${cargo.name}** ` +
                `porque ele está acima ou no mesmo nível do meu cargo.`

        };

    }

    try {

        // Remover cargos antigos de patente

        for (
            const role
            of member.roles.cache.values()
        ) {

            if (
                role.id !== guild.id &&
                PATENTES.some(
                    patenteNome =>
                        normalizar(role.name) ===
                        normalizar(patenteNome)
                )
            ) {

                if (
                    role.position <
                    botMember.roles.highest.position
                ) {

                    await member.roles.remove(
                        role,
                        "Atualização da patente EB"
                    );

                }

            }

        }

        // Adicionar nova patente

        if (
            !member.roles.cache.has(
                cargo.id
            )
        ) {

            await member.roles.add(
                cargo,
                "Patente obtida pelo DataStore Roblox"
            );

        }

        return {

            sucesso: true,

            mensagem:
                `Cargo **${cargo.name}** aplicado.`

        };

    } catch (erro) {

        console.error(
            "[CARGO] Erro:",
            erro
        );

        return {

            sucesso: false,

            mensagem:
                "Não consegui alterar os cargos. " +
                "Verifique Gerenciar Cargos e a hierarquia."

        };

    }

}

// ======================================================
// REMOVER NÃO VERIFICADO
// ======================================================

async function removerNaoVerificado(
    guild,
    member
) {

    const cargo =
        guild.roles.cache.find(
            role =>
                normalizar(role.name) ===
                normalizar(
                    NOME_CARGO_NAO_VERIFICADO
                )
        );

    if (!cargo) {

        return;

    }

    if (
        !member.roles.cache.has(
            cargo.id
        )
    ) {

        return;

    }

    try {

        const botMember =
            guild.members.me;

        if (
            botMember &&
            cargo.position <
            botMember.roles.highest.position
        ) {

            await member.roles.remove(
                cargo,
                "Jogador verificado pelo Roblox"
            );

        }

    } catch (erro) {

        console.error(
            "[VERIFICAÇÃO] Erro ao remover Não verificado:",
            erro
        );

    }

}

// ======================================================
// ALTERAR NICKNAME
// ======================================================

async function alterarNickname(
    guild,
    member,
    robloxUsername
) {

    const botMember =
        guild.members.me;

    if (!botMember) {

        throw new Error(
            "Não consegui localizar o bot no servidor."
        );

    }

    // Dono do servidor

    if (
        member.id ===
        guild.ownerId
    ) {

        throw new Error(
            "A conta testada é a dona do servidor. " +
            "Teste com outra conta Discord."
        );

    }

    // Permissão

    if (
        !botMember.permissions.has(
            PermissionFlagsBits.ManageNicknames
        )
    ) {

        throw new Error(
            "O bot não possui a permissão Gerenciar Apelidos."
        );

    }

    // Hierarquia

    if (
        member.roles.highest.position >=
        botMember.roles.highest.position
    ) {

        throw new Error(
            "O cargo mais alto desse membro está acima ou no mesmo nível do cargo do bot."
        );

    }

    await member.setNickname(
        robloxUsername,
        "Verificação da conta Roblox"
    );

}

// ======================================================
// AUTH
// ======================================================

app.get(
    "/auth",
    (req, res) => {

        const discordId =
            req.query.discord;

        if (!discordId) {

            return res.status(400).send(
                "Discord ID não informado."
            );

        }

        if (
            !ROBLOX_CLIENT_ID ||
            !ROBLOX_CLIENT_SECRET
        ) {

            return res.status(500).send(
                "ROBLOX_CLIENT_ID ou ROBLOX_CLIENT_SECRET não configurado."
            );

        }

        const state =
            gerarState();

        const codeVerifier =
            gerarCodeVerifier();

        const codeChallenge =
            gerarCodeChallenge(
                codeVerifier
            );

        sessoesOAuth.set(
            state,
            {
                discordId,
                codeVerifier,
                criadoEm: Date.now()
            }
        );

        const params =
            new URLSearchParams({

                client_id:
                    ROBLOX_CLIENT_ID,

                redirect_uri:
                    ROBLOX_REDIRECT_URI,

                scope:
                    "openid profile",

                response_type:
                    "code",

                state,

                code_challenge:
                    codeChallenge,

                code_challenge_method:
                    "S256"

            });

        const url =
            "https://apis.roblox.com/oauth/v1/authorize?" +
            params.toString();

        res.redirect(url);

    }
);

// ======================================================
// CALLBACK
// ======================================================

app.get(
    "/callback",
    async (req, res) => {

        const {
            code,
            state,
            error,
            error_description
        } = req.query;

        if (error) {

            return res.status(400).send(`
                <html>
                <body style="
                    font-family:Arial;
                    text-align:center;
                    padding:50px
                ">

                    <h1>❌ Autorização cancelada</h1>

                    <p>
                        ${error_description || error}
                    </p>

                </body>
                </html>
            `);

        }

        if (
            !code ||
            !state
        ) {

            return res.status(400).send(
                "Código ou state não informado."
            );

        }

        const sessao =
            sessoesOAuth.get(
                state
            );

        if (!sessao) {

            return res.status(400).send(
                "Sessão inválida ou expirada."
            );

        }

        sessoesOAuth.delete(
            state
        );

        if (
            Date.now() -
            sessao.criadoEm >
            10 * 60 * 1000
        ) {

            return res.status(400).send(
                "Sessão expirada."
            );

        }

        try {

            // ==========================================
            // TOKEN
            // ==========================================

            const tokenParams =
                new URLSearchParams();

            tokenParams.append(
                "client_id",
                ROBLOX_CLIENT_ID
            );

            tokenParams.append(
                "client_secret",
                ROBLOX_CLIENT_SECRET
            );

            tokenParams.append(
                "grant_type",
                "authorization_code"
            );

            tokenParams.append(
                "code",
                code
            );

            tokenParams.append(
                "code_verifier",
                sessao.codeVerifier
            );

            const tokenResponse =
                await axios.post(
                    "https://apis.roblox.com/oauth/v1/token",
                    tokenParams.toString(),
                    {
                        headers: {
                            "Content-Type":
                                "application/x-www-form-urlencoded"
                        }
                    }
                );

            const accessToken =
                tokenResponse.data.access_token;

            if (!accessToken) {

                throw new Error(
                    "Roblox não forneceu access_token."
                );

            }

            // ==========================================
            // USUÁRIO ROBLOX
            // ==========================================

            const userResponse =
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
                userResponse.data;

            const robloxUserId =
                robloxUser.sub;

            const robloxUsername =
                robloxUser.preferred_username ||
                robloxUser.nickname ||
                robloxUser.name;

            if (!robloxUserId) {

                throw new Error(
                    "Não foi possível obter o UserId Roblox."
                );

            }

            console.log(
                "[ROBLOX] ID:",
                robloxUserId
            );

            console.log(
                "[ROBLOX] Username:",
                robloxUsername
            );

            // ==========================================
            // SERVIDOR
            // ==========================================

            const guild =
                await client.guilds.fetch(
                    DISCORD_GUILD_ID
                );

            // ==========================================
            // MEMBRO
            // ==========================================

            const member =
                await guild.members.fetch(
                    sessao.discordId
                );

            // ==========================================
            // DATASTORE
            // ==========================================

            const dados =
                await buscarDadosRoblox(
                    robloxUserId
                );

            if (!dados) {

                return res.send(`
                    <html>

                    <body style="
                        background:#111;
                        color:white;
                        font-family:Arial;
                        text-align:center;
                        padding:50px;
                    ">

                        <h1>⚠️ Dados não encontrados</h1>

                        <p>
                            Sua conta Roblox foi encontrada,
                            mas não existe registro no DataStore.
                        </p>

                        <p>
                            DataStore:
                            <b>${ROBLOX_DATASTORE}</b>
                        </p>

                        <p>
                            UserId:
                            <b>${robloxUserId}</b>
                        </p>

                    </body>

                    </html>
                `);

            }

            // ==========================================
            // DADOS
            // ==========================================

            const patente =
                obterPatente(
                    dados
                );

            const divisao =
                obterDivisao(
                    dados
                );

            const cargoDivisao =
                obterCargoDivisao(
                    dados
                );

            console.log(
                "[DATASTORE] Patente:",
                patente
            );

            console.log(
                "[DATASTORE] Divisão:",
                divisao
            );

            console.log(
                "[DATASTORE] Cargo:",
                cargoDivisao
            );

            // ==========================================
            // NICKNAME
            // ==========================================

            try {

                await alterarNickname(
                    guild,
                    member,
                    robloxUsername
                );

                console.log(
                    "[DISCORD] Nickname alterado."
                );

            } catch (erro) {

                console.error(
                    "[DISCORD] Nickname:",
                    erro.message
                );

                return res.send(`
                    <html>

                    <body style="
                        background:#111;
                        color:white;
                        font-family:Arial;
                        text-align:center;
                        padding:50px;
                    ">

                        <h1>
                            ❌ Erro ao concluir a verificação
                        </h1>

                        <p>
                            Discord recusou a alteração do apelido.
                        </p>

                        <p>
                            <b>
                                ${erro.message}
                            </b>
                        </p>

                    </body>

                    </html>
                `);

            }

            // ==========================================
            // REMOVER NÃO VERIFICADO
            // ==========================================

            await removerNaoVerificado(
                guild,
                member
            );

            // ==========================================
            // APLICAR PATENTE
            // ==========================================

            const resultadoCargo =
                await aplicarPatente(
                    guild,
                    member,
                    patente
                );

            // ==========================================
            // RESULTADO
            // ==========================================

            return res.send(`
                <html>

                <head>

                    <meta charset="UTF-8">

                    <title>
                        EB - Verificação concluída
                    </title>

                </head>

                <body style="
                    background:#111;
                    color:white;
                    font-family:Arial;
                    text-align:center;
                    padding:50px;
                ">

                    <h1>
                        ✅ Verificação concluída!
                    </h1>

                    <h2>
                        ${robloxUsername}
                    </h2>

                    <p>
                        ID Roblox:
                        <b>${robloxUserId}</b>
                    </p>

                    <p>
                        Patente:
                        <b>${patente}</b>
                    </p>

                    <p>
                        Divisão:
                        <b>${divisao}</b>
                    </p>

                    ${
                        cargoDivisao
                            ? `
                                <p>
                                    Cargo:
                                    <b>${cargoDivisao}</b>
                                </p>
                            `
                            : ""
                    }

                    <p>
                        ${
                            resultadoCargo.sucesso
                                ? "✅"
                                : "⚠️"
                        }

                        ${resultadoCargo.mensagem}
                    </p>

                    <p>
                        Agora você pode voltar para o Discord.
                    </p>

                </body>

                </html>
            `);

        } catch (erro) {

            console.error(
                "[CALLBACK] ERRO:",
                erro.response?.data ||
                erro.message ||
                erro
            );

            return res.status(500).send(`
                <html>

                <body style="
                    background:#111;
                    color:white;
                    font-family:Arial;
                    text-align:center;
                    padding:50px;
                ">

                    <h1>
                        ❌ Erro ao concluir a verificação
                    </h1>

                    <p>
                        ${erro.message}
                    </p>

                </body>

                </html>
            `);

        }

    }
);

// ======================================================
// CLIENT DISCORD
// ======================================================

const client =
    new Client({

        intents: [

            GatewayIntentBits.Guilds,

            GatewayIntentBits.GuildMembers

        ]

    });

// ======================================================
// COMANDOS
// ======================================================

const comandos = [

    new SlashCommandBuilder()
        .setName("painelverificar")
        .setDescription(
            "Abre o painel para vincular o Roblox"
        ),

    new SlashCommandBuilder()
        .setName("darcargo")
        .setDescription(
            "Dá um cargo para um membro"
        )

        .addUserOption(
            option =>
                option
                    .setName("usuario")
                    .setDescription(
                        "Usuário que receberá o cargo"
                    )
                    .setRequired(true)
        )

        .addStringOption(
            option =>
                option
                    .setName("cargo")
                    .setDescription(
                        "Nome exato do cargo"
                    )
                    .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("tiracargo")
        .setDescription(
            "Remove um cargo de um membro"
        )

        .addUserOption(
            option =>
                option
                    .setName("usuario")
                    .setDescription(
                        "Usuário"
                    )
                    .setRequired(true)
        )

        .addStringOption(
            option =>
                option
                    .setName("cargo")
                    .setDescription(
                        "Nome exato do cargo"
                    )
                    .setRequired(true)
        )

].map(
    command =>
        command.toJSON()
);

// ======================================================
// PERMISSÕES DE CARGOS
// ======================================================

const permissoes = {

    "Civil": [

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
        "Elite Real"

    ],

    "Recruta": [

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
        "Elite Real"

    ],

    "Soldado": [

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
        "Elite Real"

    ],

    "Cabo": [

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
        "Elite Real"

    ],

    "3º Sargento": [
        "Civil"
    ],

    "2º Sargento": [
        "Civil"
    ],

    "1º Sargento": [
        "Civil"
    ],

    "Subtenente": [
        "Civil"
    ],

    "Cadete": [
        "Civil"
    ],

    "Aspirante a Oficial": [

        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",

        "3º Sargento",
        "2º Sargento",
        "1º Sargento",

        "Subtenente",
        "Cadete"

    ],

    "2º Tenente": [

        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",

        "3º Sargento",
        "2º Sargento",
        "1º Sargento",

        "Subtenente",
        "Cadete"

    ],

    "1º Tenente": [

        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",

        "3º Sargento",
        "2º Sargento",
        "1º Sargento",

        "Subtenente",
        "Cadete"

    ],

    "Capitão": [

        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",

        "3º Sargento",
        "2º Sargento",
        "1º Sargento",

        "Subtenente",
        "Cadete"

    ],

    "Major": [

        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",

        "3º Sargento",
        "2º Sargento",
        "1º Sargento",

        "Subtenente",
        "Cadete"

    ],

    "Tenente-Coronel": [

        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",

        "3º Sargento",
        "2º Sargento",
        "1º Sargento",

        "Subtenente",
        "Cadete"

    ],

    "Coronel": [

        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",

        "3º Sargento",
        "2º Sargento",
        "1º Sargento",

        "Subtenente",
        "Cadete"

    ],

    "General de Brigada": [

        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",

        "3º Sargento",
        "2º Sargento",
        "1º Sargento",

        "Subtenente",
        "Cadete"

    ],

    "General de Divisão": [

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

        "General de Brigada"

    ],

    "General de Exército": [

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
        "General de Divisão"

    ],

    "Elite Militar": [

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
        "General de Divisão"

    ],

    "Elite Secreta": [

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
        "General de Divisão"

    ],

    "Elite Real": [

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
        "Elite Secreta"

    ]

};

// ======================================================
// CGEX
// ======================================================

function isCGEX(member) {

    return member.roles.cache.some(
        role =>
            normalizar(role.name) ===
            normalizar("CGEX")
    );

}

// ======================================================
// BOT ONLINE
// ======================================================

client.once(
    "ready",
    async () => {

        console.log(
            `🤖 Bot online como ${client.user.tag}`
        );

        try {

            const rest =
                new REST({
                    version: "10"
                }).setToken(
                    DISCORD_TOKEN
                );

            await rest.put(

                Routes.applicationGuildCommands(
                    DISCORD_CLIENT_ID,
                    DISCORD_GUILD_ID
                ),

                {
                    body: comandos
                }

            );

            console.log(
                "✅ Comandos registrados."
            );

        } catch (erro) {

            console.error(
                "❌ Erro ao registrar comandos:",
                erro
            );

        }

    }
);

// ======================================================
// NOVO MEMBRO
// ======================================================

client.on(
    "guildMemberAdd",
    async member => {

        try {

            const cargo =
                encontrarCargo(
                    member.guild,
                    NOME_CARGO_NAO_VERIFICADO
                );

            if (!cargo) {

                return;

            }

            const botMember =
                member.guild.members.me;

            if (
                botMember &&
                cargo.position <
                botMember.roles.highest.position
            ) {

                await member.roles.add(
                    cargo,
                    "Novo membro aguardando verificação"
                );

                console.log(
                    `[ENTRADA] ${member.user.tag} recebeu Não verificado.`
                );

            }

        } catch (erro) {

            console.error(
                "[ENTRADA] Erro:",
                erro
            );

        }

    }
);

// ======================================================
// INTERAÇÕES
// ======================================================

client.on(
    "interactionCreate",
    async interaction => {

        try {

            // ==========================================
            // BOTÃO VINCULAR ROBLOX
            // ==========================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                "vincular_roblox"
            ) {

                const url =
                    `${ROBLOX_REDIRECT_URI.replace(
                        "/callback",
                        "/auth"
                    )}?discord=${interaction.user.id}`;

                return interaction.reply({

                    content:
                        "🔗 Clique abaixo para vincular sua conta Roblox.",

                    components: [

                        new ActionRowBuilder()
                            .addComponents(

                                new ButtonBuilder()

                                    .setLabel(
                                        "Vincular Roblox"
                                    )

                                    .setStyle(
                                        ButtonStyle.Link
                                    )

                                    .setURL(
                                        url
                                    )

                            )

                    ],

                    ephemeral: true

                });

            }

            // ==========================================
            // PAINEL VERIFICAR
            // LIBERADO PARA TODO MUNDO
            // ==========================================

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
                            "Clique no botão abaixo para vincular sua conta Roblox ao Discord.\n\n" +

                            "Após a autorização, seu nickname será alterado para o nome do Roblox e sua patente será aplicada automaticamente."
                        );

                const row =
                    new ActionRowBuilder()
                        .addComponents(

                            new ButtonBuilder()

                                .setCustomId(
                                    "vincular_roblox"
                                )

                                .setLabel(
                                    "Vincular Roblox"
                                )

                                .setEmoji(
                                    "🔗"
                                )

                                .setStyle(
                                    ButtonStyle.Primary
                                )

                        );

                return interaction.reply({

                    embeds: [
                        embed
                    ],

                    components: [
                        row
                    ]

                });

            }

            // ==========================================
            // DAR CARGO
            // ==========================================

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                "darcargo"
            ) {

                const alvo =
                    interaction.options.getMember(
                        "usuario"
                    );

                const nomeCargo =
                    interaction.options.getString(
                        "cargo"
                    );

                if (!alvo) {

                    return interaction.reply({

                        content:
                            "❌ Usuário não encontrado.",

                        ephemeral: true

                    });

                }

                const cargo =
                    encontrarCargo(
                        interaction.guild,
                        nomeCargo
                    );

                if (!cargo) {

                    return interaction.reply({

                        content:
                            `❌ O cargo **${nomeCargo}** não existe.`,

                        ephemeral: true

                    });

                }

                if (
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.ManageRoles
                    ) &&
                    !isCGEX(
                        interaction.member
                    )
                ) {

                    return interaction.reply({

                        content:
                            "❌ Você não tem permissão para dar cargos.",

                        ephemeral: true

                    });

                }

                const cargoDoMembro =
                    interaction.member.roles.highest;

                const cargosPermitidos =
                    permissoes[
                        cargoDoMembro.name
                    ] || [];

                if (
                    !isCGEX(
                        interaction.member
                    ) &&
                    !cargosPermitidos.some(
                        permitido =>
                            normalizar(
                                permitido
                            ) ===
                            normalizar(
                                cargo.name
                            )
                    )
                ) {

                    return interaction.reply({

                        content:
                            "❌ Sua patente não pode dar esse cargo.",

                        ephemeral: true

                    });

                }

                const botMember =
                    interaction.guild.members.me;

                if (
                    cargo.position >=
                    botMember.roles.highest.position
                ) {

                    return interaction.reply({

                        content:
                            "❌ Meu cargo precisa estar acima do cargo que será dado.",

                        ephemeral: true

                    });

                }

                try {

                    await alvo.roles.add(
                        cargo,
                        `Cargo dado por ${interaction.user.tag}`
                    );

                    return interaction.reply({

                        content:
                            `✅ Cargo **${cargo.name}** dado para ${alvo}.`

                    });

                } catch (erro) {

                    console.error(
                        "[DARCARGO]",
                        erro
                    );

                    return interaction.reply({

                        content:
                            "❌ Não consegui dar o cargo. Verifique a hierarquia do bot.",

                        ephemeral: true

                    });

                }

            }

            // ==========================================
            // TIRA CARGO
            // ==========================================

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                "tiracargo"
            ) {

                const alvo =
                    interaction.options.getMember(
                        "usuario"
                    );

                const nomeCargo =
                    interaction.options.getString(
                        "cargo"
                    );

                if (
                    !isCGEX(
                        interaction.member
                    )
                ) {

                    return interaction.reply({

                        content:
                            "❌ Apenas CGEX pode retirar cargos.",

                        ephemeral: true

                    });

                }

                const cargo =
                    encontrarCargo(
                        interaction.guild,
                        nomeCargo
                    );

                if (!cargo) {

                    return interaction.reply({

                        content:
                            `❌ O cargo **${nomeCargo}** não existe.`,

                        ephemeral: true

                    });

                }

                try {

                    await alvo.roles.remove(
                        cargo,
                        `Cargo retirado por ${interaction.user.tag}`
                    );

                    return interaction.reply({

                        content:
                            `✅ Cargo **${cargo.name}** retirado de ${alvo}.`

                    });

                } catch (erro) {

                    console.error(
                        "[TIRACARGO]",
                        erro
                    );

                    return interaction.reply({

                        content:
                            "❌ Não consegui retirar o cargo.",

                        ephemeral: true

                    });

                }

            }

        } catch (erro) {

            console.error(
                "[INTERACTION]",
                erro
            );

            if (
                !interaction.replied
            ) {

                await interaction.reply({

                    content:
                        "❌ Ocorreu um erro ao executar o comando.",

                    ephemeral: true

                });

            }

        }

    }
);

// ======================================================
// LIMPEZA OAUTH
// ======================================================

setInterval(
    () => {

        const agora =
            Date.now();

        for (
            const [
                state,
                sessao
            ]
            of sessoesOAuth.entries()
        ) {

            if (
                agora -
                sessao.criadoEm >
                10 * 60 * 1000
            ) {

                sessoesOAuth.delete(
                    state
                );

            }

        }

    },
    60 * 1000
);

// ======================================================
// CONFIGURAÇÕES
// ======================================================

console.log(
    "=========================================="
);

console.log(
    "🇧🇷 EB DISCORD"
);

console.log(
    "=========================================="
);

console.log(
    "Universe ID:",
    ROBLOX_UNIVERSE_ID
);

console.log(
    "DataStore:",
    ROBLOX_DATASTORE
);

console.log(
    "Redirect URI:",
    ROBLOX_REDIRECT_URI
);

console.log(
    "DataStore API Key:",

    ROBLOX_API_KEY
        ? "CONFIGURADA"
        : "NÃO CONFIGURADA"
);

console.log(
    "Discord Token:",

    DISCORD_TOKEN
        ? "CONFIGURADO"
        : "NÃO CONFIGURADO"
);

// ======================================================
// SERVIDOR
// ======================================================

app.listen(
    PORT,
    () => {

        console.log(
            `🌐 Servidor HTTP rodando na porta ${PORT}`
        );

    }
);

// ======================================================
// LOGIN
// ======================================================

if (!DISCORD_TOKEN) {

    console.error(
        "❌ DISCORD_TOKEN não configurado."
    );

} else {

    console.log(
        "🔌 Tentando conectar ao Discord..."
    );

    client.login(
        DISCORD_TOKEN
    );

}
