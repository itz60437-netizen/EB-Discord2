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

const app = express();

const PORT = process.env.PORT || 3000;

// =====================================================
// CONFIGURAÇÕES
// =====================================================

const NOME_CARGO_NAO_VERIFICADO =
    process.env.NOME_CARGO_NAO_VERIFICADO || "Não verificado";

const ROBLOX_CLIENT_ID =
    process.env.ROBLOX_CLIENT_ID;

const ROBLOX_CLIENT_SECRET =
    process.env.ROBLOX_CLIENT_SECRET;

const ROBLOX_REDIRECT_URI =
    process.env.ROBLOX_REDIRECT_URI ||
    "https://eb-discord.onrender.com/callback";

const DISCORD_CLIENT_ID =
    process.env.DISCORD_CLIENT_ID ||
    "1554245914791772261";

const DISCORD_GUILD_ID =
    process.env.DISCORD_GUILD_ID ||
    "1554839511824072704";

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
// SESSÕES OAUTH
// =====================================================

const estadosOAuth = new Map();

// =====================================================
// SERVIDOR WEB
// =====================================================

app.get("/", (req, res) => {

    res.send(`
        <!DOCTYPE html>

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

// =====================================================
// CODE CHALLENGE ROBLOX
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

        const discordId = req.query.discord;

        if (!discordId) {

            return res
                .status(400)
                .send("Discord ID não informado.");
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
            crypto.randomBytes(32).toString("hex");

        const codeVerifier =
            crypto.randomBytes(64).toString("base64url");

        const codeChallenge =
            gerarCodeChallenge(codeVerifier);

        estadosOAuth.set(state, {
            discordId,
            codeVerifier,
            criadoEm: Date.now()
        });

        const params = new URLSearchParams({

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

app.get("/callback", async (req, res) => {

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
                        Volte ao Discord e tente novamente.
                    </p>
                `);
        }

        estadosOAuth.delete(state);

        if (
            Date.now() - dados.criadoEm >
            10 * 60 * 1000
        ) {

            return res
                .status(400)
                .send(
                    "Sessão expirada."
                );
        }

        // =================================================
        // TOKEN ROBLOX
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
        // DADOS ROBLOX
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
                "Nome Roblox não encontrado."
            );
        }

        console.log(
            `Roblox vinculado: ${robloxUsername} (${robloxId})`
        );

        // =================================================
        // SERVIDOR
        // =================================================

        const guild =
            client.guilds.cache.get(
                DISCORD_GUILD_ID
            ) ||
            client.guilds.cache.first();

        if (!guild) {

            throw new Error(
                "Servidor Discord não encontrado."
            );
        }

        // =================================================
        // MEMBRO
        // =================================================

        const membro =
            await guild.members.fetch(
                dados.discordId
            );

        const botMember =
            guild.members.me;

        if (!botMember) {

            throw new Error(
                "Bot não encontrado no servidor."
            );
        }

        // =================================================
        // PERMISSÃO NICKNAME
        // =================================================

        if (
            !botMember.permissions.has(
                PermissionFlagsBits.ManageNicknames
            )
        ) {

            throw new Error(
                "O bot não possui Gerenciar Apelidos."
            );
        }

        // =================================================
        // PERMISSÃO CARGOS
        // =================================================

        if (
            !botMember.permissions.has(
                PermissionFlagsBits.ManageRoles
            )
        ) {

            throw new Error(
                "O bot não possui Gerenciar Cargos."
            );
        }

        // =================================================
        // HIERARQUIA
        // =================================================

        if (
            membro.roles.highest.position >=
            botMember.roles.highest.position
        ) {

            throw new Error(
                "O cargo do usuário está acima ou no mesmo nível do bot."
            );
        }

        // =================================================
        // ALTERAR NICK
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
                cargoNaoVerificado.position <
                botMember.roles.highest.position
            ) {

                if (
                    membro.roles.cache.has(
                        cargoNaoVerificado.id
                    )
                ) {

                    await membro.roles.remove(
                        cargoNaoVerificado
                    );
                }
            }
        }

        // =================================================
        // SUCESSO
        // =================================================

        res.send(`

            <!DOCTYPE html>

            <html>

            <head>

                <meta charset="UTF-8">

                <title>
                    Vinculação concluída
                </title>

            </head>

            <body style="
                background:#111;
                color:white;
                font-family:Arial;
                text-align:center;
                padding-top:80px;
            ">

                <div style="
                    background:#1c1c1c;
                    padding:30px;
                    margin:auto;
                    max-width:500px;
                    border-radius:15px;
                ">

                    <h1 style="color:#00ff88">
                        ✅ Vinculação concluída!
                    </h1>

                    <p>
                        Sua conta Roblox foi vinculada.
                    </p>

                    <p>
                        <strong>Roblox:</strong>
                        ${robloxUsername}
                    </p>

                    <p>
                        Seu apelido no Discord
                        foi atualizado.
                    </p>

                    <p>
                        Você pode voltar ao Discord.
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
                <h1>❌ Erro ao vincular</h1>
                <p>
                    Não foi possível concluir a vinculação.
                </p>
            `);
    }
});

// =====================================================
// LIMPAR OAUTH EXPIRADO
// =====================================================

setInterval(() => {

    const agora =
        Date.now();

    for (
        const [state, dados]
        of estadosOAuth.entries()
    ) {

        if (
            agora - dados.criadoEm >
            10 * 60 * 1000
        ) {

            estadosOAuth.delete(state);
        }
    }

}, 60 * 1000);

// =====================================================
// COMANDO /PAINELVERIFICAR
// =====================================================

const comandos = [

    new SlashCommandBuilder()
        .setName("painelverificar")
        .setDescription(
            "Envia o painel de verificação Roblox."
        )

].map(
    comando =>
        comando.toJSON()
);

// =====================================================
// REGISTRAR SOMENTE /PAINELVERIFICAR
// =====================================================
//
// IMPORTANTE:
// Não usa guild.fetch()
// Não usa DISCORD_GUILD_ID
// Não registra painel automaticamente.
// =====================================================

client.once("clientReady", async () => {

    console.log(
        `🤖 Bot conectado como ${client.user.tag}`
    );

    try {

        const rest =
            new REST({
                version: "10"
            }).setToken(
                process.env.DISCORD_TOKEN
            );

        await rest.put(
            Routes.applicationCommands(
                DISCORD_CLIENT_ID
            ),
            {
                body: comandos
            }
        );

        console.log(
            "✅ Comando /painelverificar registrado."
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao registrar /painelverificar:",
            erro
        );
    }
});

// =====================================================
// ENTRADA DE NOVO MEMBRO
// =====================================================
//
// ATENÇÃO:
// NÃO EXISTE ENVIO DE PAINEL AQUI.
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

            if (!cargoNaoVerificado) {

                console.log(
                    "⚠️ Cargo Não verificado não encontrado."
                );

                return;
            }

            const botMember =
                membro.guild.members.me;

            if (!botMember) {
                return;
            }

            if (
                cargoNaoVerificado.position >=
                botMember.roles.highest.position
            ) {

                console.log(
                    "⚠️ Cargo Não verificado está acima do bot."
                );

                return;
            }

            if (
                !membro.roles.cache.has(
                    cargoNaoVerificado.id
                )
            ) {

                await membro.roles.add(
                    cargoNaoVerificado
                );

                console.log(
                    `🔒 ${membro.user.tag} recebeu Não verificado.`
                );
            }

        } catch (erro) {

            console.error(
                "❌ Erro ao colocar Não verificado:",
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
            // /PAINELVERIFICAR
            // =================================================

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                "painelverificar"
            ) {

                // ---------------------------------------------
                // CGEX
                // ---------------------------------------------

                const temCGEX =
                    interaction.member.roles.cache.some(
                        role =>
                            role.name ===
                            "CGEX"
                    );

                if (!temCGEX) {

                    return interaction.reply({

                        content:
                            "❌ Apenas o cargo **CGEX** pode usar este comando.",

                        ephemeral:
                            true
                    });
                }

                // ---------------------------------------------
                // EMBED
                // ---------------------------------------------

                const embed =
                    new EmbedBuilder()

                        .setTitle(
                            "🇧🇷 Verificação EB"
                        )

                        .setDescription(

                            "Para verificar sua conta e liberar " +
                            "seu acesso ao servidor, você precisa " +
                            "vincular sua conta Roblox.\n\n" +

                            "Clique no botão abaixo para começar " +
                            "a verificação."
                        )

                        .setFooter({
                            text:
                                "EB | Sistema de Verificação"
                        });

                // ---------------------------------------------
                // BOTÃO
                // ---------------------------------------------

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

                // ---------------------------------------------
                // ENVIAR PAINEL
                // ---------------------------------------------

                await interaction.channel.send({

                    embeds: [
                        embed
                    ],

                    components: [
                        row
                    ]
                });

                return interaction.reply({

                    content:
                        "✅ Painel de verificação enviado.",

                    ephemeral:
                        true
                });
            }

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

                        ephemeral:
                            true
                    });
                }

                const authUrl =
                    ROBLOX_REDIRECT_URI.replace(
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

                    ephemeral:
                        true
                });
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
                        "❌ Ocorreu um erro."
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
// SERVIDOR WEB
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
            `🆔 Discord Client ID: ${DISCORD_CLIENT_ID}`
        );

        console.log(
            "📋 Painel automático: DESATIVADO"
        );

        console.log(
            "👤 Painel ao entrar: DESATIVADO"
        );

        console.log(
            "⚙️ Comando: /painelverificar"
        );
    }
);

// =====================================================
// LOGIN
// =====================================================

client.login(
    process.env.DISCORD_TOKEN
);
