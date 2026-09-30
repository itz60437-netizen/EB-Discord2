const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    PermissionFlagsBits,
    Routes
} = require("discord.js");

require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// ==================================================
// PERMISSÕES
// ==================================================

const permissoes = {

    // ==================================================
    // PATENTES EB
    // ==================================================

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

    // ==================================================
    // BAC
    // ==================================================

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
        "Aluno a Comandos BAC",
        "Comandos BAC"
    ],

    // ==================================================
    // BIP
    // ==================================================

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

    // ==================================================
    // CIE
    // ==================================================

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
        "Aluno a Professor CIE",
        "Professor CIE"
    ],

    "Professor CIE": [
        "Candidato CIE",
        "Aluno CIE",
        "Aluno a Professor CIE"
    ]
};

// ==================================================
// CGEX
// ==================================================

function isCGEX(interaction) {

    const cargoCGEX =
        interaction.guild.roles.cache.find(
            role => role.name === "CGEX"
        );

    if (!cargoCGEX) {
        return false;
    }

    if (!interaction.member) {
        return false;
    }

    if (!interaction.member.roles) {
        return false;
    }

    return interaction.member.roles.cache.has(
        cargoCGEX.id
    );
}

// ==================================================
// REGISTRAR COMANDOS
// ==================================================

async function registrarComandos() {

    const darCargo = new SlashCommandBuilder()
        .setName("darcargo")
        .setDescription("Dá um cargo EB para um usuário")
        .addUserOption(opcao =>
            opcao
                .setName("usuario")
                .setDescription("Usuário que receberá o cargo")
                .setRequired(true)
        )
        .addRoleOption(opcao =>
            opcao
                .setName("cargo")
                .setDescription("Cargo que será dado")
                .setRequired(true)
        );

    const tiraCargo = new SlashCommandBuilder()
        .setName("tiracargo")
        .setDescription("Retira um cargo de um usuário")
        .addUserOption(opcao =>
            opcao
                .setName("usuario")
                .setDescription("Usuário que perderá o cargo")
                .setRequired(true)
        )
        .addRoleOption(opcao =>
            opcao
                .setName("cargo")
                .setDescription("Cargo que será retirado")
                .setRequired(true)
        );

    await client.application.commands.set([
        darCargo,
        tiraCargo
    ]);

    console.log(
        "✅ /darcargo e /tiracargo registrados!"
    );
}

// ==================================================
// BOT ONLINE
// ==================================================

client.once("ready", async () => {

    console.log(
        `✅ Bot conectado como ${client.user.tag}`
    );

    await registrarComandos();

});

// ==================================================
// INTERAÇÕES
// ==================================================

client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) {
        return;
    }

    // ==================================================
    // DARCARGO
    // ==================================================

    if (interaction.commandName === "darcargo") {

        try {

            await interaction.deferReply({
                ephemeral: true
            });

            const usuario =
                interaction.options.getUser("usuario");

            const cargo =
                interaction.options.getRole("cargo");

            if (!usuario || !cargo) {

                return interaction.editReply(
                    "❌ Usuário ou cargo não encontrado."
                );
            }

            // ==================================================
            // CGEX
            // ==================================================

            const executorEhCGEX =
                isCGEX(interaction);

            // ==================================================
            // PEGAR TODOS OS CARGOS DO EXECUTOR
            // ==================================================

            let cargosDoExecutor = [];

            if (
                interaction.member &&
                interaction.member.roles
            ) {

                for (
                    const nomeCargo
                    of Object.keys(permissoes)
                ) {

                    const cargoEncontrado =
                        interaction.guild.roles.cache.find(
                            role =>
                                role.name === nomeCargo
                        );

                    if (!cargoEncontrado) {
                        continue;
                    }

                    if (
                        interaction.member.roles.cache.has(
                            cargoEncontrado.id
                        )
                    ) {

                        cargosDoExecutor.push(
                            nomeCargo
                        );
                    }
                }
            }

            // ==================================================
            // VERIFICAR TODAS AS PERMISSÕES
            // ==================================================

            let podeDarCargo = false;

            let cargoQuePermitiu = null;

            for (
                const cargoExecutor
                of cargosDoExecutor
            ) {

                const cargosPermitidos =
                    permissoes[cargoExecutor];

                if (!cargosPermitidos) {
                    continue;
                }

                if (
                    cargosPermitidos.includes(
                        cargo.name
                    )
                ) {

                    podeDarCargo = true;

                    cargoQuePermitiu =
                        cargoExecutor;

                    break;
                }
            }

            // ==================================================
            // SEM PERMISSÃO
            // ==================================================

            if (
                !executorEhCGEX &&
                !podeDarCargo
            ) {

                if (
                    cargosDoExecutor.length === 0
                ) {

                    return interaction.editReply(
                        "❌ Você não possui uma patente ou cargo de divisão reconhecido."
                    );
                }

                return interaction.editReply(
                    `❌ Nenhum dos seus cargos pode dar o cargo **${cargo.name}**.`
                );
            }

            // ==================================================
            // BUSCAR MEMBRO
            // ==================================================

            let membro;

            try {

                membro = await client.rest.get(
                    Routes.guildMember(
                        interaction.guild.id,
                        usuario.id
                    )
                );

            } catch (erro) {

                return interaction.editReply(
                    "❌ Não consegui encontrar esse usuário no servidor."
                );
            }

            // ==================================================
            // BOT
            // ==================================================

            const botMember =
                interaction.guild.members.me;

            if (!botMember) {

                return interaction.editReply(
                    "❌ Não consegui identificar o bot."
                );
            }

            // ==================================================
            // PERMISSÃO
            // ==================================================

            if (
                !botMember.permissions.has(
                    PermissionFlagsBits.ManageRoles
                )
            ) {

                return interaction.editReply(
                    "❌ O bot não possui **Gerenciar Cargos**."
                );
            }

            // ==================================================
            // HIERARQUIA
            // ==================================================

            if (
                cargo.position >=
                botMember.roles.highest.position
            ) {

                return interaction.editReply(
                    "❌ O cargo do bot precisa estar acima do cargo que será entregue."
                );
            }

            // ==================================================
            // JÁ POSSUI
            // ==================================================

            if (
                membro.roles &&
                membro.roles.includes(cargo.id)
            ) {

                return interaction.editReply(
                    `⚠️ **${usuario.username}** já possui o cargo **${cargo.name}**.`
                );
            }

            // ==================================================
            // DAR CARGO
            // ==================================================

            await client.rest.put(
                Routes.guildMemberRole(
                    interaction.guild.id,
                    usuario.id,
                    cargo.id
                )
            );

            if (executorEhCGEX) {

                return interaction.editReply(
                    `✅ **${cargo.name}** foi dado para **${usuario.username}** com sucesso!`
                );
            }

            return interaction.editReply(
                `✅ **${cargo.name}** foi dado para **${usuario.username}** com sucesso!\n` +
                `📋 Permissão utilizada: **${cargoQuePermitiu}**`
            );

        } catch (erro) {

            console.error(
                "❌ ERRO NO /DARCARGO:"
            );

            console.error(erro);

            if (
                interaction.deferred ||
                interaction.replied
            ) {

                await interaction.editReply(
                    `❌ Erro: ${erro.message}`
                ).catch(() => {});
            }
        }
    }

    // ==================================================
    // TIRACARGO
    // ==================================================

    if (interaction.commandName === "tiracargo") {

        try {

            await interaction.deferReply({
                ephemeral: true
            });

            const usuario =
                interaction.options.getUser("usuario");

            const cargo =
                interaction.options.getRole("cargo");

            if (!usuario || !cargo) {

                return interaction.editReply(
                    "❌ Usuário ou cargo não encontrado."
                );
            }

            // ==================================================
            // SOMENTE CGEX
            // ==================================================

            if (!isCGEX(interaction)) {

                return interaction.editReply(
                    "❌ Apenas membros do **CGEX** podem usar o /tiracargo."
                );
            }

            // ==================================================
            // BUSCAR MEMBRO
            // ==================================================

            let membro;

            try {

                membro = await client.rest.get(
                    Routes.guildMember(
                        interaction.guild.id,
                        usuario.id
                    )
                );

            } catch (erro) {

                return interaction.editReply(
                    "❌ Não consegui encontrar esse usuário no servidor."
                );
            }

            // ==================================================
            // BOT
            // ==================================================

            const botMember =
                interaction.guild.members.me;

            if (!botMember) {

                return interaction.editReply(
                    "❌ Não consegui identificar o bot."
                );
            }

            // ==================================================
            // PERMISSÃO
            // ==================================================

            if (
                !botMember.permissions.has(
                    PermissionFlagsBits.ManageRoles
                )
            ) {

                return interaction.editReply(
                    "❌ O bot não possui **Gerenciar Cargos**."
                );
            }

            // ==================================================
            // HIERARQUIA
            // ==================================================

            if (
                cargo.position >=
                botMember.roles.highest.position
            ) {

                return interaction.editReply(
                    "❌ O cargo do bot precisa estar acima do cargo que será retirado."
                );
            }

            // ==================================================
            // VERIFICAR CARGO
            // ==================================================

            if (
                !membro.roles ||
                !membro.roles.includes(cargo.id)
            ) {

                return interaction.editReply(
                    `⚠️ **${usuario.username}** não possui o cargo **${cargo.name}**.`
                );
            }

            // ==================================================
            // RETIRAR
            // ==================================================

            await client.rest.delete(
                Routes.guildMemberRole(
                    interaction.guild.id,
                    usuario.id,
                    cargo.id
                )
            );

            return interaction.editReply(
                `✅ **${cargo.name}** foi retirado de **${usuario.username}** com sucesso!`
            );

        } catch (erro) {

            console.error(
                "❌ ERRO NO /TIRACARGO:"
            );

            console.error(erro);

            if (
                interaction.deferred ||
                interaction.replied
            ) {

                await interaction.editReply(
                    `❌ Erro: ${erro.message}`
                ).catch(() => {});
            }
        }
    }
});

// ==================================================
// LOGIN
// ==================================================

client.login(
    process.env.DISCORD_TOKEN
);
