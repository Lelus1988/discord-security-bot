import { 
    SlashCommandBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder, 
    ChatInputCommandInteraction, 
    PermissionFlagsBits,
    GuildTextBasedChannel // Wichtig für den TypeScript-Fix
} from 'discord.js';

export default {
    // ==========================================
    // 1. COMMAND REGISTRIERUNG
    // ==========================================
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Sendet eine Nachricht in den jetzigen Kanal (nur für Moderatoren).')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) // Nur für Mods sichtbar
        .setDMPermission(false), // Blockiert in Direktnachrichten

    // ==========================================
    // 2. HAUPTLOGIK
    // ==========================================
    async execute(interaction: ChatInputCommandInteraction) {
        const modalId = `sayModal-${interaction.id}`;
        const inputId = 'sayInput';

        // Modal (Pop-up) erstellen
        const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle('Nachricht verfassen');

        // Großes Textfeld (Paragraph) für den Inhalt
        const textInput = new TextInputBuilder()
            .setCustomId(inputId)
            .setLabel('Inhalt der Nachricht')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Schreibe hier deine Nachricht...')
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(4000);

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(textInput);
        modal.addComponents(row);

        // Zeigt dem Moderator das Pop-up an
        await interaction.showModal(modal);

        // ==========================================
        // 3. EVENT-COLLECTOR FÜR DAS MODAL
        // ==========================================
        try {
            const submission = await interaction.awaitModalSubmit({
                filter: (i) => i.customId === modalId && i.user.id === interaction.user.id,
                time: 600000 
            });

            const messageContent = submission.fields.getTextInputValue(inputId);

            // Zeitstempel für den Footer generieren (Format: TT.MM.JJJJ • HH:MM:SS)
            const now = new Date();
            const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const moderatorName = submission.member && 'displayName' in submission.member 
                ? submission.member.displayName 
                : submission.user.username;
                
            const footerText = `Erstellt von ${moderatorName} • ${dateStr} • ${timeStr}`;

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31) 
                .setDescription(messageContent)
                .setTimestamp(now)
                .setFooter({ text: footerText });

            // Ephemeral Antwort senden, um die Interaktion sauber abzuschließen
            await submission.reply({ 
                content: '✅ Deine Nachricht wird gesendet...', 
                ephemeral: true 
            });

            // ==========================================
            // 4. FEHLERFREIES SENDEN (Typen-Assertion)
            // ==========================================
            // Hier casten wir den Kanal explizit, damit TS den .send() Fehler vergisst
            const channel = interaction.channel as GuildTextBasedChannel | null;

            if (channel) {
                await channel.send({ embeds: [embed] });
                
                await submission.editReply({
                    content: '✅ Deine Nachricht wurde erfolgreich in diesem Kanal gesendet!'
                });
            } else {
                await submission.editReply({ 
                    content: '❌ **Fehler:** Kanal konnte nicht als Textkanal identifiziert werden.' 
                });
            }

        } catch (error) {
            console.log(`[Modal] Zeit abgelaufen oder abgebrochen durch User: ${interaction.user.tag}`);
        }
    }
};