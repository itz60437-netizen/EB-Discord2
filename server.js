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


// ======================================================
// CONFIGURAÇÕES
// ======================================================

const CANAL_VERIFICACAO_ID = "1554839511824072704";
const NOME_CARGO_NAO_VERIFICADO = "Não verificado";

const ROBLOX_CLIENT_ID = process.env.ROBLOX_CLIENT_ID;
const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET;

const ROBLOX_REDIRECT_URI =
    process.env.ROBLOX_REDIRECT_URI ||
    "https://eb-discord2-1.onrender.com/callback";

const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;


// ======================================================
// DISCORD
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});


// ======================================================
// EXPRESS
// ======================================================

const app = express();

app.use(express.json());


// ======================================================
// PÁGINA INICIAL
// ======================================================

app.get("/", (req, res) => {
    res.send(`
        <html>
            <head>
                <title>EB Discord</title>
                <meta charset="UTF-8">
            </head>
            <body>
                <h1>EB Discord Online</h1>
                <p>Sistema funcionando.</p>
            </body>
        </html>
    `);
});


// ======================================================
// OAUTH ROBLOX - PKCE
// ======================================================

const sessoesOAuth = new Map();

function gerarCodeVerifier() {
    return crypto
        .randomBytes(32)
        .toString("base64url");
}

function gerarCodeChallenge(codeVerifier) {
    return crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");
}


// ======================================================
// INICIAR OAUTH
// ======================================================

app.get("/auth", async (req, res) => {

    try {

        const discordId = req.query.discord;

        if (!discordId) {
            return res.status(400).send(`
                <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Erro</title>
                    </head>
                    <body>
                        <h2>❌ ID do Discord não informado.</h2>
                        <p>Abra este endereço através do botão de vinculação no Discord.</p>
                    </body>
                </html>
            `);
        }

        const codeVerifier = gerarCodeVerifier();
        const codeChallenge = gerarCodeChallenge(codeVerifier);

        const state = crypto
            .randomBytes(32)
            .toString("hex");

        sessoesOAuth.set(state, {
            discordId,
            codeVerifier,
            criadoEm: Date.now()
        });

        const params = new URLSearchParams({
            client_id: ROBLOX_CLIENT_ID,
            redirect_uri: ROBLOX_REDIRECT_URI,
            response_type: "code",
            scope: "openid profile",
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256"
        });

        const url =
            "https://apis.roblox.com/oauth/v1/authorize?" +
            params.toString();

        res.redirect(url);

    } catch (erro) {

        console.error("❌ Erro no /auth:", erro);

        res.status(500).send(`
            <h2>❌ Erro ao iniciar a vinculação.</h2>
        `);
    }
});


// ======================================================
// CALLBACK ROBLOX
// ======================================================

app.get("/callback", async (req, res) => {

    try {

        const {
            code,
            state
        } = req.query;

        if (!code || !state) {
            return res.status(400).send(`
                <h2>❌ Código ou state não informado.</h2>
            `);
        }

        const sessao = sessoesOAuth.get(state);

        if (!sessao) {
            return res.status(400).send(`
                <h2>❌ Sessão OAuth inválida ou expirada.</h2>
            `);
        }

        sessoesOAuth.delete(state);

        // ==================================================
        // TROCAR CODE PELO TOKEN
        // ==================================================

        const tokenResponse = await axios.post(
            "https://apis.roblox.com/oauth/v1/token",
            new URLSearchParams({
                client_id: ROBLOX_CLIENT_ID,
                client_secret: ROBLOX_CLIENT_SECRET,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: ROBLOX_REDIRECT_URI,
                code_verifier: sessao.codeVerifier
            }).toString(),
            {
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                }
            }
        );

        const accessToken =
            tokenResponse.data.access_token;


        // ==================================================
        // PEGAR DADOS DO ROBLOX
        // ==================================================

        const userResponse = await axios.get(
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

        console.log(
            `🔗 Roblox vinculado: ${robloxUsername} (${robloxId})`
        );


        // ==================================================
        // PEGAR SERVIDOR DISCORD
        // ==================================================

        let guild;

        if (DISCORD_GUILD_ID) {

            guild =
                client.guilds.cache.get(
                    DISCORD_GUILD_ID
                );

        }

        if (!guild) {

            guild =
                client.guilds.cache.first();

        }

        if (!guild) {
            throw new Error(
                "Bot não está em nenhum servidor."
            );
        }


        // ==================================================
        // PEGAR MEMBRO
        // ==================================================

        const member =
            await guild.members.fetch(
                sessao.discordId
            );


        // ==================================================
        // PEGAR BOT
        // ==================================================

        const botMember =
            guild.members.me;

        if (!botMember) {
            throw new Error(
                "Não foi possível localizar o bot no servidor."
            );
        }


        // ==================================================
        // VERIFICAR PERMISSÕES
        // ==================================================

        if (
            !botMember.permissions.has(
                PermissionFlagsBits.ManageNicknames
            )
        ) {
            throw new Error(
                "O bot não possui permissão para alterar apelidos."
            );
        }

        if (
            !botMember.permissions.has(
                PermissionFlagsBits.ManageRoles
            )
        ) {
            throw new Error(
                "O bot não possui permissão para gerenciar cargos."
            );
        }


        // ==================================================
        // VERIFICAR HIERARQUIA
        // ==================================================

        if (
            member.roles.highest.position >=
            botMember.roles.highest.position
        ) {

            throw new Error(
                "O cargo do usuário está acima ou no mesmo nível do bot."
            );
        }


        // ==================================================
        // ALTERAR APELIDO
        // ==================================================

        await member.setNickname(
            robloxUsername
        );


        // ==================================================
        // REMOVER NÃO VERIFICADO
        // ==================================================

        const cargoNaoVerificado =
            guild.roles.cache.find(
                role =>
                    role.name ===
                    NOME_CARGO_NAO_VERIFICADO
            );

        if (
            cargoNaoVerificado &&
            member.roles.cache.has(
                cargoNaoVerificado.id
            )
        ) {

            await member.roles.remove(
                cargoNaoVerificado
            );
        }


        // ==================================================
        // SUCESSO
        // ==================================================

        res.send(`
            <html>
                <head>
                    <meta charset="UTF-8">

                    <style>
                        body {
                            font-family: Arial;
                            text-align: center;
                            margin-top: 80px;
                            background: #111;
                            color: white;
                        }

                        .box {
                            background: #222;
                            padding: 30px;
                            border-radius: 15px;
                            max-width: 500px;
                            margin: auto;
                        }
                    </style>
                </head>

                <body>

                    <div class="box">

                        <h1>✅ Verificação concluída!</h1>

                        <p>
                            Sua conta Roblox foi vinculada ao Discord.
                        </p>

                        <p>
                            <b>Roblox:</b>
                            ${robloxUsername}
                        </p>

                        <p>
                            Seu apelido do Discord foi atualizado.
                        </p>

                    </div>

                </body>
            </html>
        `);

    } catch (erro) {

        console.error(
            "❌ Erro no callback:",
            erro
        );

        res.status(500).send(`
            <html>
                <head>
                    <meta charset="UTF-8">
                </head>

                <body>

                    <h2>❌ Erro ao concluir a verificação.</h2>

                    <p>
                        ${erro.message}
                    </p>

                </body>
            </html>
        `);
    }
});


// ======================================================
// LIMPAR SESSÕES OAUTH
// ======================================================

setInterval(() => {

    const agora = Date.now();

    for (
        const [state, sessao]
        of sessoesOAuth.entries()
    ) {

        if (
            agora - sessao.criadoEm >
            10 * 60 * 1000
        ) {

            sessoesOAuth.delete(state);

        }
    }

}, 60 * 1000);


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
    ],

    "Comandante do BAC": [
        "Comandante do BAC",
        "Subcomandante do BAC",
        "Instrutor BAC"
    ],

    "Subcomandante do BAC": [
        "Instrutor BAC"
    ],

    "Instrutor BAC": [],

    "Comandante da BIP": [
        "Comandante da BIP",
        "Subcomandante da BIP",
        "Professor Geral BIP",
        "Professor BIP",
        "Instrutor BIP"
    ],

    "Subcomandante da BIP": [
        "Professor Geral BIP",
        "Professor BIP",
        "Instrutor BIP"
    ],

    "Professor Geral BIP": [
        "Professor BIP",
        "Instrutor BIP"
    ],

    "Professor BIP": [
        "Instrutor BIP"
    ],

    "Instrutor BIP": [],

    "Comandante do CIE": [
        "Comandante do CIE",
        "Subcomandante do CIE",
        "Instrutor CIE",
        "Professor CIE"
    ],

    "Subcomandante do CIE": [
        "Instrutor CIE",
        "Professor CIE"
    ],

    "Instrutor CIE": [
        "Professor CIE"
    ],

    "Professor CIE": []
};


// ======================================================
// VERIFICAR CGEX
// ======================================================

function isCGEX(interaction) {

    return interaction.member.roles.cache.some(
        role => role.name === "CGEX"
    );
}


// ======================================================
// COMANDOS
// ======================================================

const comandos = [

    new SlashCommandBuilder()
        .setName("darcargo")
        .setDescription("Dar um cargo para um usuário.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que receberá o cargo.")
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName("cargo")
                .setDescription("Cargo que será dado.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("tiracargo")
        .setDescription("Retirar um cargo de um usuário.")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuário que perderá o cargo.")
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName("cargo")
                .setDescription("Cargo que será retirado.")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("painelverificar")
        .setDescription("Enviar o painel de verificação Roblox.")
];


// ======================================================
// REGISTRAR COMANDOS
// ======================================================

client.once("ready", async () => {

    console.log(
        `🤖 Bot conectado como ${client.user.tag}`
    );

    try {

        const rest = new REST({
            version: "10"
        }).setToken(
            process.env.DISCORD_TOKEN
        );

        const guild =
            client.guilds.cache.first();

        if (!guild) {

            console.log(
                "❌ O bot não está em nenhum servidor."
            );

            return;
        }

        await rest.put(
            Routes.applicationGuildCommands(
                client.user.id,
                guild.id
            ),
            {
                body: comandos.map(
                    comando => comando.toJSON()
                )
            }
        );

        console.log(
            `✅ Comandos registrados no servidor ${guild.name}`
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao registrar comandos:",
            erro
        );
    }
});


// ======================================================
// NOVO MEMBRO
// ======================================================

client.on(
    "guildMemberAdd",
    async member => {

        try {

            const cargo =
                member.guild.roles.cache.find(
                    role =>
                        role.name ===
                        NOME_CARGO_NAO_VERIFICADO
                );

            if (
                cargo &&
                member.guild.members.me
                    .permissions.has(
                        PermissionFlagsBits.ManageRoles
                    )
            ) {

                if (
                    cargo.position <
                    member.guild.members.me.roles.highest.position
                ) {

                    await member.roles.add(
                        cargo
                    );

                    console.log(
                        `🔒 ${member.user.tag} recebeu Não verificado.`
                    );
                }
            }

        } catch (erro) {

            console.error(
                "❌ Erro ao configurar novo membro:",
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

            // ==================================================
            // BOTÃO VINCULAR ROBLOX
            // ==================================================

            if (
                interaction.isButton() &&
                interaction.customId ===
                "vincular_roblox"
            ) {

                /*
                 * ALTERAÇÃO FEITA AQUI:
                 *
                 * O /auth agora recebe obrigatoriamente
                 * o ID do usuário que clicou no botão.
                 */

                const authUrl =
                    `${ROBLOX_REDIRECT_URI.replace(
                        /\/callback\/?$/,
                        "/auth"
                    )}?discord=${interaction.user.id}`;

                await interaction.reply({
                    content:
                        `🔗 **Clique abaixo para vincular sua conta Roblox ao Discord:**\n\n${authUrl}`,
                    ephemeral: true
                });

                return;
            }


            // ==================================================
            // /PAINELVERIFICAR
            // ==================================================

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                "painelverificar"
            ) {

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "🔗 Verificação Roblox"
                        )
                        .setDescription(
                            "Clique no botão abaixo para vincular sua conta Roblox ao Discord."
                        )
                        .setColor(
                            0x5865F2
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

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            botao
                        );

                await interaction.channel.send({
                    embeds: [embed],
                    components: [row]
                });

                await interaction.reply({
                    content:
                        "✅ Painel de verificação enviado.",
                    ephemeral: true
                });

                return;
            }


            // ==================================================
            // /DARCARGO
            // ==================================================

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                "darcargo"
            ) {

                if (
                    !interaction.guild.members.me.permissions.has(
                        PermissionFlagsBits.ManageRoles
                    )
                ) {

                    return interaction.reply({
                        content:
                            "❌ Eu não tenho permissão para gerenciar cargos.",
                        ephemeral: true
                    });
                }

                const usuario =
                    interaction.options.getMember(
                        "usuario"
                    );

                const cargo =
                    interaction.options.getRole(
                        "cargo"
                    );

                if (!usuario) {

                    return interaction.reply({
                        content:
                            "❌ Usuário não encontrado.",
                        ephemeral: true
                    });
                }

                if (!cargo) {

                    return interaction.reply({
                        content:
                            "❌ Cargo não encontrado.",
                        ephemeral: true
                    });
                }


                // ==================================================
                // HIERARQUIA DO BOT
                // ==================================================

                const botMember =
                    interaction.guild.members.me;

                if (
                    cargo.position >=
                    botMember.roles.highest.position
                ) {

                    return interaction.reply({
                        content:
                            "❌ Não posso dar um cargo que esteja acima ou no mesmo nível do meu cargo.",
                        ephemeral: true
                    });
                }


                // ==================================================
                // HIERARQUIA DO USUÁRIO
                // ==================================================

                if (
                    usuario.roles.highest.position >=
                    botMember.roles.highest.position
                ) {

                    return interaction.reply({
                        content:
                            "❌ Não posso alterar cargos desse usuário.",
                        ephemeral: true
                    });
                }


                // ==================================================
                // JÁ POSSUI
                // ==================================================

                if (
                    usuario.roles.cache.has(
                        cargo.id
                    )
                ) {

                    return interaction.reply({
                        content:
                            "❌ Esse usuário já possui esse cargo.",
                        ephemeral: true
                    });
                }


                // ==================================================
                // CGEX PODE DAR
                // ==================================================

                if (!isCGEX(interaction)) {

                    const cargoExecutor =
                        interaction.member.roles.cache.find(
                            role =>
                                permissoes[role.name]
                        );

                    if (!cargoExecutor) {

                        return interaction.reply({
                            content:
                                "❌ Você não possui permissão para dar cargos.",
                            ephemeral: true
                        });
                    }

                    const permitidos =
                        permissoes[
                            cargoExecutor.name
                        ] || [];

                    if (
                        !permitidos.includes(
                            cargo.name
                        )
                    ) {

                        return interaction.reply({
                            content:
                                "❌ Você não possui permissão para dar esse cargo.",
                            ephemeral: true
                        });
                    }
                }


                // ==================================================
                // ADICIONAR CARGO
                // ==================================================

                await usuario.roles.add(
                    cargo
                );

                await interaction.reply({
                    content:
                        `✅ Cargo **${cargo.name}** dado para ${usuario.user}.`
                });

                return;
            }


            // ==================================================
            // /TIRACARGO
            // ==================================================

            if (
                interaction.isChatInputCommand() &&
                interaction.commandName ===
                "tiracargo"
            ) {

                if (!isCGEX(interaction)) {

                    return interaction.reply({
                        content:
                            "❌ Apenas o CGEX pode retirar cargos.",
                        ephemeral: true
                    });
                }

                if (
                    !interaction.guild.members.me.permissions.has(
                        PermissionFlagsBits.ManageRoles
                    )
                ) {

                    return interaction.reply({
                        content:
                            "❌ Eu não tenho permissão para gerenciar cargos.",
                        ephemeral: true
                    });
                }

                const usuario =
                    interaction.options.getMember(
                        "usuario"
                    );

                const cargo =
                    interaction.options.getRole(
                        "cargo"
                    );

                if (!usuario) {

                    return interaction.reply({
                        content:
                            "❌ Usuário não encontrado.",
                        ephemeral: true
                    });
                }

                if (!cargo) {

                    return interaction.reply({
                        content:
                            "❌ Cargo não encontrado.",
                        ephemeral: true
                    });
                }


                // ==================================================
                // HIERARQUIA
                // ==================================================

                const botMember =
                    interaction.guild.members.me;

                if (
                    cargo.position >=
                    botMember.roles.highest.position
                ) {

                    return interaction.reply({
                        content:
                            "❌ Não posso retirar um cargo que esteja acima ou no mesmo nível do meu cargo.",
                        ephemeral: true
                    });
                }


                // ==================================================
                // NÃO POSSUI
                // ==================================================

                if (
                    !usuario.roles.cache.has(
                        cargo.id
                    )
                ) {

                    return interaction.reply({
                        content:
                            "❌ Esse usuário não possui esse cargo.",
                        ephemeral: true
                    });
                }


                // ==================================================
                // REMOVER
                // ==================================================

                await usuario.roles.remove(
                    cargo
                );

                await interaction.reply({
                    content:
                        `✅ Cargo **${cargo.name}** retirado de ${usuario.user}.`
                });

                return;
            }

        } catch (erro) {

            console.error(
                "❌ Erro na interação:",
                erro
            );

            if (
                interaction.replied ||
                interaction.deferred
            ) {

                await interaction.followUp({
                    content:
                        "❌ Ocorreu um erro ao executar essa ação.",
                    ephemeral: true
                }).catch(() => {});

            } else {

                await interaction.reply({
                    content:
                        "❌ Ocorreu um erro ao executar essa ação.",
                    ephemeral: true
                }).catch(() => {});
            }
        }
    }
);


// ======================================================
// SERVIDOR WEB
// ======================================================

const PORT =
    process.env.PORT || 3000;

app.listen(
    PORT,
    () => {

        console.log(
            `🌐 Servidor web iniciado na porta ${PORT}`
        );

        console.log(
            `🔗 Callback OAuth: ${ROBLOX_REDIRECT_URI}`
        );
    }
);


// ======================================================
// LOGIN DISCORD
// ======================================================

client.login(
    process.env.DISCORD_TOKEN
);
