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

const {
    REST
} = require("@discordjs/rest");

const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

require("dotenv").config();

const app = express();

const PORT =
    process.env.PORT || 3000;

// =====================================================
// CONFIGURAÇÕES
// =====================================================

const CANAL_VERIFICACAO_ID =
    process.env.CANAL_VERIFICACAO_ID;

const NOME_CARGO_NAO_VERIFICADO =
    process.env.NOME_CARGO_NAO_VERIFICADO ||
    "Não verificado";

const ROBLOX_CLIENT_ID =
    process.env.ROBLOX_CLIENT_ID;

const ROBLOX_CLIENT_SECRET =
    process.env.ROBLOX_CLIENT_SECRET;

const ROBLOX_REDIRECT_URI =
    process.env.ROBLOX_REDIRECT_URI ||
    "https://eb-discord.onrender.com/callback";

const DISCORD_GUILD_ID =
    process.env.DISCORD_GUILD_ID ||
    "1554839511824072704";

const DISCORD_CLIENT_ID =
    process.env.DISCORD_CLIENT_ID ||
    "1554245914791772261";

// =====================================================
// CLIENT DISCORD
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =====================================================
// SERVIDOR WEB
// =====================================================

app.get("/", (req, res) => {

    res.send(`
        <html>

            <head>
                <meta charset="UTF-8">
                <title>EB Discord</title>
            </head>

            <body>

                <h1>🇧🇷 EB Discord Online</h1>

                <p>
                    Sistema funcionando.
                </p>

            </body>

        </html>
    `);
});

// =====================================================
// OAUTH
// =====================================================

const estadosOAuth =
    new Map();

// =====================================================
// CODE CHALLENGE
// =====================================================

function gerarCodeChallenge(codeVerifier) {

    return crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

// =====================================================
// INICIAR OAUTH
// =====================================================

app.get("/auth", (req, res) => {

    try {

        const discordId =
            req.query.discord;

        if (!discordId) {

            return res
                .status(400)
                .send(
                    "Discord ID não informado."
                );
        }

        if (
            !ROBLOX_CLIENT_ID ||
            !ROBLOX_CLIENT_SECRET
        ) {

            return res
                .status(500)
                .send(
                    "ROBLOX_CLIENT_ID ou ROBLOX_CLIENT_SECRET não configurado."
                );
        }

        const state =
            crypto
                .randomBytes(32)
                .toString("hex");

        const codeVerifier =
            crypto
                .randomBytes(64)
                .toString("base64url");

        const codeChallenge =
            gerarCodeChallenge(
                codeVerifier
            );

        estadosOAuth.set(
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

                state:
                    state,

                code_challenge:
                    codeChallenge,

                code_challenge_method:
                    "S256",

                prompt:
                    "login"
            });

        const url =
            "https://apis.roblox.com/oauth/v1/authorize?" +
            params.toString();

        res.redirect(url);

    } catch (erro) {

        console.error(
            "Erro ao iniciar OAuth:",
            erro
        );

        res
            .status(500)
            .send(
                "Erro ao iniciar vinculação com Roblox."
            );
    }
});

// =====================================================
// CALLBACK ROBLOX
// =====================================================

app.get(
    "/callback",
    async (req, res) => {

        try {

            const {
                code,
                state,
                error,
                error_description
            } = req.query;

            if (error) {

                return res
                    .status(400)
                    .send(`
                        <h1>❌ Login cancelado</h1>

                        <p>
                            ${
                                error_description ||
                                error
                            }
                        </p>
                    `);
            }

            if (!code || !state) {

                return res
                    .status(400)
                    .send(
                        "Código ou state não informado."
                    );
            }

            const dados =
                estadosOAuth.get(state);

            if (!dados) {

                return res
                    .status(400)
                    .send(`
                        <h1>❌ Sessão expirada</h1>

                        <p>
                            Volte ao Discord e tente vincular novamente.
                        </p>
                    `);
            }

            estadosOAuth.delete(state);

            if (
                Date.now() -
                dados.criadoEm >
                10 * 60 * 1000
            ) {

                return res
                    .status(400)
                    .send(`
                        <h1>❌ Sessão expirada</h1>

                        <p>
                            Volte ao Discord e tente novamente.
                        </p>
                    `);
            }

            // =================================================
            // TROCAR CODE PELO TOKEN
            // =================================================

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
                dados.codeVerifier
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
                    "Roblox não retornou access_token."
                );
            }

            // =================================================
            // PEGAR DADOS DO USUÁRIO ROBLOX
            // =================================================

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

            const robloxUsername =
                robloxUser.preferred_username;

            const robloxId =
                robloxUser.sub;

            if (!robloxUsername) {

                throw new Error(
                    "Nome de usuário Roblox não encontrado."
                );
            }

            console.log(
                `Roblox vinculado: ${robloxUsername} (${robloxId})`
            );

            // =================================================
            // PEGAR SERVIDOR DISCORD
            // =================================================

            let guild;

            if (DISCORD_GUILD_ID) {

                guild =
                    await client.guilds.fetch(
                        DISCORD_GUILD_ID
                    );

            } else {

                guild =
                    client.guilds.cache.first();
            }

            if (!guild) {

                throw new Error(
                    "Servidor Discord não encontrado."
                );
            }

            // =================================================
            // PEGAR MEMBRO
            // =================================================

            const membro =
                await guild.members.fetch(
                    dados.discordId
                );

            // =================================================
            // VERIFICAR BOT
            // =================================================

            const botMember =
                guild.members.me;

            if (!botMember) {

                throw new Error(
                    "Não consegui encontrar o bot no servidor."
                );
            }

            if (
                !botMember.permissions.has(
                    PermissionFlagsBits.ManageNicknames
                )
            ) {

                throw new Error(
                    "O bot não possui a permissão Gerenciar Apelidos."
                );
            }

            if (
                !botMember.permissions.has(
                    PermissionFlagsBits.ManageRoles
                )
            ) {

                throw new Error(
                    "O bot não possui a permissão Gerenciar Cargos."
                );
            }

            // =================================================
            // HIERARQUIA DO BOT
            // =================================================

            if (
                membro.roles.highest.position >=
                botMember.roles.highest.position
            ) {

                throw new Error(
                    "O cargo mais alto do usuário está acima ou no mesmo nível do bot."
                );
            }

            // =================================================
            // ALTERAR NICKNAME
            // =================================================

            await membro.setNickname(
                robloxUsername
            );

            // =================================================
            // REMOVER NÃO VERIFICADO
            // =================================================

            const cargoNaoVerificado =
                guild.roles.cache.find(
                    role =>
                        role.name ===
                        NOME_CARGO_NAO_VERIFICADO
                );

            if (cargoNaoVerificado) {

                if (
                    cargoNaoVerificado.position >=
                    botMember.roles.highest.position
                ) {

                    console.log(
                        "⚠️ O cargo Não verificado está acima do bot."
                    );

                } else if (
                    membro.roles.cache.has(
                        cargoNaoVerificado.id
                    )
                ) {

                    await membro.roles.remove(
                        cargoNaoVerificado
                    );
                }
            }

            // =================================================
            // SUCESSO
            // =================================================

            res.send(`

                <html>

                    <head>

                        <meta charset="UTF-8">

                        <title>
                            Vinculação concluída
                        </title>

                        <style>

                            body {

                                background: #111;

                                color: white;

                                font-family: Arial;

                                text-align: center;

                                padding-top: 80px;
                            }

                            .box {

                                background: #1c1c1c;

                                padding: 30px;

                                margin: auto;

                                max-width: 500px;

                                border-radius: 15px;
                            }

                            h1 {

                                color: #00ff88;
                            }

                        </style>

                    </head>

                    <body>

                        <div class="box">

                            <h1>
                                ✅ Vinculação concluída!
                            </h1>

                            <p>
                                Sua conta Roblox foi vinculada
                                com sucesso.
                            </p>

                            <p>

                                <strong>
                                    Roblox:
                                </strong>

                                ${robloxUsername}

                            </p>

                            <p>
                                Seu apelido no Discord
                                foi atualizado.
                            </p>

                            <p>
                                Você já pode voltar
                                para o Discord.
                            </p>

                        </div>

                    </body>

                </html>

            `);

            console.log(
                `✅ ${robloxUsername} vinculou o Discord ${dados.discordId}`
            );

        } catch (erro) {

            console.error(
                "Erro no callback Roblox:",
                erro.response?.data ||
                erro.message
            );

            res
                .status(500)
                .send(`

                    <html>

                        <head>

                            <meta charset="UTF-8">

                            <title>
                                Erro
                            </title>

                        </head>

                        <body>

                            <h1>
                                ❌ Erro ao vincular
                            </h1>

                            <p>
                                Não foi possível concluir
                                a vinculação.
                            </p>

                            <p>
                                Volte ao Discord e tente
                                novamente.
                            </p>

                        </body>

                    </html>

                `);
        }
    }
);

// =====================================================
// LIMPAR SESSÕES OAUTH EXPIRADAS
// =====================================================

setInterval(() => {

    const agora =
        Date.now();

    for (
        const [state, dados]
        of estadosOAuth.entries()
    ) {

        if (
            agora -
            dados.criadoEm >
            10 * 60 * 1000
        ) {

            estadosOAuth.delete(state);
        }
    }

}, 60 * 1000);

// =====================================================
// PERMISSÕES DOS CARGOS
// =====================================================

const permissoes = {

    "Civil": [],

    "Recruta": [],

    "Soldado": [],

    "Cabo": [],

    "3ºSargento": [
        "Civil"
    ],

    "2ºSargento": [
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
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete"
    ],

    "2ºTenente": [
        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete"
    ],

    "1ºTenente": [
        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete"
    ],

    "Capitão": [
        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete"
    ],

    "Major": [
        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete"
    ],

    "Tenente-Coronel": [
        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete"
    ],

    "Coronel": [
        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete"
    ],

    "General de Brigada": [
        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete",
        "Aspirante a Oficial",
        "2ºTenente",
        "1ºTenente",
        "Capitão",
        "Major",
        "Tenente-Coronel",
        "Coronel",
        "General de Brigada"
    ],

    "General de Divisão": [
        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete",
        "Aspirante a Oficial",
        "2ºTenente",
        "1ºTenente",
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
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete",
        "Aspirante a Oficial",
        "2ºTenente",
        "1ºTenente",
        "Capitão",
        "Major",
        "Tenente-Coronel",
        "Coronel",
        "General de Brigada"
    ],

    "Elite Militar": [
        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete",
        "Aspirante a Oficial",
        "2ºTenente",
        "1ºTenente",
        "Capitão",
        "Major",
        "Tenente-Coronel",
        "Coronel",
        "General de Brigada"
    ],

    "Elite Secreta": [
        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete",
        "Aspirante a Oficial",
        "2ºTenente",
        "1ºTenente",
        "Capitão",
        "Major",
        "Tenente-Coronel",
        "Coronel",
        "General de Brigada"
    ],

    "Elite Real": [
        "Civil",
        "Recruta",
        "Soldado",
        "Cabo",
        "3ºSargento",
        "2ºSargento",
        "1º Sargento",
        "Subtenente",
        "Cadete",
        "Aspirante a Oficial",
        "2ºTenente",
        "1ºTenente",
        "Capitão",
        "Major",
        "Tenente-Coronel",
        "Coronel",
        "General de Brigada"
    ],

    "Comandante do BAC": [
        "Subcomandante do BAC",
        "Instrutor BAC",
        "Comandos BAC",
        "Aluno a Comandos BAC",
        "Aluno BAC",
        "Candidato BAC"
    ],

    "Subcomandante do BAC": [
        "Instrutor BAC",
        "Comandos BAC",
        "Aluno a Comandos BAC",
        "Aluno BAC",
        "Candidato BAC"
    ],

    "Instrutor BAC": [
        "Candidato BAC",
        "Aluno BAC",
        "Aluno a Comandos BAC"
    ],

    "Comandante da BIP": [
        "Subcomandante da BIP",
        "Professor Geral BIP",
        "Professor BIP",
        "Instrutor BIP",
        "Paraquedista BIP",
        "Estagiário BIP",
        "Aluno BIP",
        "Candidato BIP"
    ],

    "Subcomandante da BIP": [
        "Professor Geral BIP",
        "Professor BIP",
        "Instrutor BIP",
        "Paraquedista BIP",
        "Estagiário BIP",
        "Aluno BIP",
        "Candidato BIP"
    ],

    "Professor Geral BIP": [
        "Candidato BIP",
        "Aluno BIP",
        "Estagiário BIP",
        "Paraquedista BIP",
        "Instrutor BIP",
        "Professor BIP"
    ],

    "Professor BIP": [
        "Candidato BIP",
        "Aluno BIP",
        "Estagiário BIP",
        "Paraquedista BIP",
        "Instrutor BIP"
    ],

    "Instrutor BIP": [
        "Candidato BIP",
        "Aluno BIP",
        "Estagiário BIP",
        "Paraquedista BIP"
    ],

    "Comandante do CIE": [
        "Subcomandante do CIE",
        "Instrutor CIE",
        "Professor CIE",
        "Aluno a Professor CIE",
        "Aluno CIE",
        "Candidato CIE"
    ],

    "Subcomandante do CIE": [
        "Instrutor CIE",
        "Professor CIE",
        "Aluno a Professor CIE",
        "Aluno CIE",
        "Candidato CIE"
    ],

    "Instrutor CIE": [
        "Candidato CIE",
        "Aluno CIE",
        "Aluno a Professor CIE"
    ],

    "Professor CIE": [
        "Candidato CIE",
        "Aluno CIE",
        "Aluno a Professor CIE"
    ]
};

// =====================================================
// VERIFICAR CGEX
// =====================================================

function isCGEX(member) {

    return member.roles.cache.some(
        role =>
            role.name === "CGEX"
    );
}

// =====================================================
// COMANDOS SLASH
// =====================================================

const comandos = [

    new SlashCommandBuilder()

        .setName("darcargo")

        .setDescription(
            "Dá um cargo a um usuário."
        )

        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário")
                .setRequired(true)
        )

        .addRoleOption(option =>
            option
                .setName("cargo")
                .setDescription("Cargo")
                .setRequired(true)
        ),

    new SlashCommandBuilder()

        .setName("tiracargo")

        .setDescription(
            "Remove um cargo de um usuário."
        )

        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário")
                .setRequired(true)
        )

        .addRoleOption(option =>
            option
                .setName("cargo")
                .setDescription("Cargo")
                .setRequired(true)
        )

].map(
    command =>
        command.toJSON()
);

// =====================================================
// NÃO REGISTRAR COMANDOS AUTOMATICAMENTE
// =====================================================
//
// O bloco antigo:
//
// client.once("clientReady", ... rest.put(...))
//
// FOI REMOVIDO.
//
// O bot NÃO vai mais tentar registrar comandos
// usando DISCORD_GUILD_ID.
// =====================================================

// =====================================================
// COMANDO !PAINELVERIFICAR
// =====================================================

client.on(
    "messageCreate",
    async mensagem => {

        try {

            if (
                mensagem.author.bot
            ) {
                return;
            }

            if (
                !mensagem.guild
            ) {
                return;
            }

            if (
                mensagem.content
                    .trim()
                    .toLowerCase() !==
                "!painelverificar"
            ) {
                return;
            }

            // =================================================
            // VERIFICAR CGEX
            // =================================================

            if (
                !isCGEX(
                    mensagem.member
                )
            ) {

                await mensagem.reply(
                    "❌ Apenas o cargo **CGEX** pode usar este comando."
                );

                return;
            }

            // =================================================
            // EMBED
            // =================================================

            const embed =
                new EmbedBuilder()

                    .setTitle(
                        "🇧🇷 Verificação EB"
                    )

                    .setDescription(

                        "Para entrar e permanecer no servidor, " +
                        "você precisa vincular sua conta Roblox.\n\n" +

                        "Clique no botão abaixo para começar " +
                        "a verificação."
                    )

                    .setFooter({
                        text:
                            "EB | Sistema de Verificação"
                    });

            // =================================================
            // BOTÃO
            // =================================================

            const botao =
                new ButtonBuilder()

                    .setCustomId(
                        "vincular_roblox"
                    )

                    .setLabel(
                        "🔗 Vincular Roblox"
                    )

                    .setStyle(
                        ButtonStyle.Primary
                    );

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        botao
                    );

            // =================================================
            // ENVIAR PAINEL
            // =================================================

            await mensagem.channel.send({

                embeds: [
                    embed
                ],

                components: [
                    row
                ]

            });

            console.log(
                `✅ Painel criado por ${mensagem.author.tag}`
            );

        } catch (erro) {

            console.error(
                "❌ Erro no !painelverificar:",
                erro
            );
        }
    }
);

// =====================================================
// NOVO MEMBRO
// =====================================================
//
// NÃO ENVIA MAIS PAINEL AUTOMATICAMENTE.
// Apenas coloca o cargo Não verificado.
// =====================================================

client.on(
    "guildMemberAdd",
    async membro => {

        try {

            const cargoNaoVerificado =
                membro.guild.roles.cache.find(
                    role =>
                        role.name ===
                        NOME_CARGO_NAO_VERIFICADO
                );

            if (
                cargoNaoVerificado &&
                !membro.roles.cache.has(
                    cargoNaoVerificado.id
                )
            ) {

                const botMember =
                    membro.guild.members.me;

                if (
                    botMember &&
                    cargoNaoVerificado.position <
                    botMember.roles.highest.position
                ) {

                    await membro.roles.add(
                        cargoNaoVerificado
                    );

                    console.log(
                        `🔒 Cargo Não verificado colocado em ${membro.user.tag}`
                    );
                }
            }

        } catch (erro) {

            console.error(
                "❌ Erro ao adicionar cargo Não verificado:",
                erro
            );
        }
    }
);

// =====================================================
// INTERAÇÕES
// =====================================================

client.on(
    "interactionCreate",
    async interaction => {

        try {

            // =================================================
            // BOTÃO VINCULAR ROBLOX
            // =================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                "vincular_roblox"
            ) {

                if (!ROBLOX_CLIENT_ID) {

                    return interaction.reply({

                        content:
                            "❌ O sistema Roblox ainda não está configurado.",

                        ephemeral: true
                    });
                }

                const authUrl =

                    ROBLOX_REDIRECT_URI
                        .replace(
                            "/callback",
                            "/auth"
                        ) +

                    "?discord=" +

                    encodeURIComponent(
                        interaction.user.id
                    );

                return interaction.reply({

                    content:

                        "🔗 **Clique abaixo para vincular sua conta Roblox:**\n\n" +

                        `[🇧🇷 Vincular Roblox](${authUrl})`,

                    ephemeral: true
                });
            }

            // =================================================
            // SLASH COMMANDS
            // =================================================

            if (
                !interaction.isChatInputCommand()
            ) {

                return;
            }

            // =================================================
            // /DARCARGO
            // =================================================

            if (
                interaction.commandName ===
                "darcargo"
            ) {

                await interaction.deferReply({
                    ephemeral: true
                });

                const usuario =
                    interaction.options.getUser(
                        "usuario"
                    );

                const cargo =
                    interaction.options.getRole(
                        "cargo"
                    );

                if (!usuario || !cargo) {

                    return interaction.editReply(
                        "❌ Usuário ou cargo inválido."
                    );
                }

                const membro =
                    await interaction.guild.members
                        .fetch(usuario.id)
                        .catch(
                            () => null
                        );

                if (!membro) {

                    return interaction.editReply(
                        "❌ Não encontrei esse usuário no servidor."
                    );
                }

                const botMember =
                    interaction.guild.members.me;

                if (
                    !botMember.permissions.has(
                        PermissionFlagsBits.ManageRoles
                    )
                ) {

                    return interaction.editReply(
                        "❌ O bot não possui a permissão Gerenciar Cargos."
                    );
                }

                if (
                    cargo.position >=
                    botMember.roles.highest.position
                ) {

                    return interaction.editReply(
                        "❌ Esse cargo está acima ou no mesmo nível do meu cargo."
                    );
                }

                if (
                    membro.roles.cache.has(
                        cargo.id
                    )
                ) {

                    return interaction.editReply(
                        "❌ Esse usuário já possui esse cargo."
                    );
                }

                // =================================================
                // CGEX
                // =================================================

                if (
                    !isCGEX(
                        interaction.member
                    )
                ) {

                    const cargosExecutor =
                        interaction.member.roles.cache
                            .map(
                                role =>
                                    role.name
                            );

                    let podeDar =
                        false;

                    for (
                        const cargoExecutor
                        of cargosExecutor
                    ) {

                        const permitidos =
                            permissoes[
                                cargoExecutor
                            ];

                        if (
                            permitidos &&
                            permitidos.includes(
                                cargo.name
                            )
                        ) {

                            podeDar =
                                true;

                            break;
                        }
                    }

                    if (!podeDar) {

                        return interaction.editReply(
                            "❌ Você não possui permissão para dar esse cargo."
                        );
                    }
                }

                await membro.roles.add(
                    cargo
                );

                return interaction.editReply(

                    `✅ O cargo **${cargo.name}** foi dado para ${membro}.`

                );
            }

            // =================================================
            // /TIRACARGO
            // =================================================

            if (
                interaction.commandName ===
                "tiracargo"
            ) {

                await interaction.deferReply({
                    ephemeral: true
                });

                if (
                    !isCGEX(
                        interaction.member
                    )
                ) {

                    return interaction.editReply(
                        "❌ Apenas o cargo **CGEX** pode usar este comando."
                    );
                }

                const usuario =
                    interaction.options.getUser(
                        "usuario"
                    );

                const cargo =
                    interaction.options.getRole(
                        "cargo"
                    );

                if (!usuario || !cargo) {

                    return interaction.editReply(
                        "❌ Usuário ou cargo inválido."
                    );
                }

                const membro =
                    await interaction.guild.members
                        .fetch(usuario.id)
                        .catch(
                            () => null
                        );

                if (!membro) {

                    return interaction.editReply(
                        "❌ Não encontrei esse usuário no servidor."
                    );
                }

                const botMember =
                    interaction.guild.members.me;

                if (
                    !botMember.permissions.has(
                        PermissionFlagsBits.ManageRoles
                    )
                ) {

                    return interaction.editReply(
                        "❌ O bot não possui a permissão Gerenciar Cargos."
                    );
                }

                if (
                    cargo.position >=
                    botMember.roles.highest.position
                ) {

                    return interaction.editReply(
                        "❌ Esse cargo está acima ou no mesmo nível do meu cargo."
                    );
                }

                if (
                    !membro.roles.cache.has(
                        cargo.id
                    )
                ) {

                    return interaction.editReply(
                        "❌ Esse usuário não possui esse cargo."
                    );
                }

                await membro.roles.remove(
                    cargo
                );

                return interaction.editReply(

                    `✅ O cargo **${cargo.name}** foi removido de ${membro}.`

                );
            }

        } catch (erro) {

            console.error(
                "❌ Erro na interação:",
                erro
            );

            if (
                interaction.deferred
            ) {

                await interaction
                    .editReply(
                        "❌ Ocorreu um erro ao executar o comando."
                    )
                    .catch(
                        () => {}
                    );

            } else if (
                !interaction.replied
            ) {

                await interaction
                    .reply({

                        content:
                            "❌ Ocorreu um erro.",

                        ephemeral:
                            true
                    })
                    .catch(
                        () => {}
                    );
            }
        }
    }
);

// =====================================================
// INICIAR SERVIDOR WEB
// =====================================================

app.listen(
    PORT,
    () => {

        console.log(
            `🌐 Servidor web rodando na porta ${PORT}`
        );

        console.log(
            `🔗 Callback Roblox: ${ROBLOX_REDIRECT_URI}`
        );

        console.log(
            `🏠 Servidor Discord: ${DISCORD_GUILD_ID}`
        );

        console.log(
            `🆔 Aplicação Discord: ${DISCORD_CLIENT_ID}`
        );

        console.log(
            `📋 Canal de verificação: ${
                CANAL_VERIFICACAO_ID ||
                "NÃO CONFIGURADO"
            }`
        );
    }
);

// =====================================================
// LOGIN DISCORD
// =====================================================

client.login(
    process.env.DISCORD_TOKEN
);
