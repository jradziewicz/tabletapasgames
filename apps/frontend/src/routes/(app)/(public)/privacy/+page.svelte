<script lang="ts">
    // Address shown for privacy questions. Change this to whatever you want to publish.
    const CONTACT_EMAIL = 'jradziewicz@gmail.com'
    const LAST_UPDATED = 'September 29, 2026'
</script>

<svelte:head>
    <title>Privacy Policy — TableTapas Games</title>
    <meta
        name="description"
        content="How TableTapas Games collects, uses and protects your information."
    />
</svelte:head>

<main class="legal-page collection-page">
    <header class="collection-header">
        <h1 class="collection-heading">Privacy Policy</h1>
    </header>
    <p class="updated">Last updated {LAST_UPDATED}</p>

    <p>
        TableTapas Games (“we”, “us”) runs a free website for playing board games online at
        play.tabletapasgames.com. This policy explains what information we collect when you use the
        site and what we do with it.
    </p>

    <h2>Information we collect</h2>
    <ul>
        <li>
            <strong>Account details.</strong> Your username, email address, and either a password
            (stored only as a salted hash) or the identifier of the Google or Discord account you
            sign in with.
        </li>
        <li>
            <strong>Sign-in with Google or Discord.</strong> If you use one of these, we receive
            your account identifier, your email address and your display name from that provider. We
            do not receive your provider password and we do not access your contacts, files or
            messages.
        </li>
        <li>
            <strong>Game activity.</strong> The games you create or join, the moves you make, chat
            messages and game results, which are visible to the other players in those games.
        </li>
        <li>
            <strong>Technical data.</strong> A session token stored in your browser to keep you
            signed in, and standard server logs (such as IP address and request time) used to keep
            the site running and secure.
        </li>
    </ul>

    <h2>How we use it</h2>
    <p>
        We use this information to run your account, host games, show other players your username,
        send you notices you have asked for (such as game invitations, “it’s your turn” alerts and
        password resets), and to keep the site secure. We do not sell your information, and we do
        not use it for advertising.
    </p>

    <h2>Notifications</h2>
    <p>
        We may email you about your games. If a game’s host has connected a Discord channel, your
        Discord user may be mentioned there when it is your turn. You can change your notification
        preferences in your account settings.
    </p>

    <h2>Sharing</h2>
    <p>
        Other players in your games can see your username and in-game activity. We do not share your
        email address with other players. We use service providers to operate the site, including
        Google Cloud for hosting and storage and an email delivery service for outgoing email; they
        process data only on our behalf. We may disclose information if required by law.
    </p>

    <h2>Retention and deletion</h2>
    <p>
        We keep your account and game data while your account is active. You can delete your account
        from your account settings, or email us and we will delete it. Games you played in may keep
        an anonymized record of moves so other players’ game histories remain intact.
    </p>

    <h2>Children</h2>
    <p>
        The site is not directed to children under 13, and we do not knowingly collect information
        from them.
    </p>

    <h2>Changes</h2>
    <p>
        We may update this policy from time to time. The date at the top shows when it last changed.
    </p>

    <h2>Contact</h2>
    <p>
        Questions or requests about your data: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        See also our <a href="/terms">Terms of Service</a>.
    </p>
</main>

<style>
    .legal-page {
        max-width: 760px;
        padding-bottom: 64px;
        color: var(--color-gray-300);
        font-size: 15px;
        line-height: 1.7;
    }
    .updated {
        margin-bottom: 20px;
        color: var(--color-gray-500);
        font-size: 13px;
    }
    h2 {
        margin: 28px 0 8px;
        font-family: 'Source Sans 3', sans-serif;
        font-size: 22px;
        font-weight: 600;
        color: var(--color-gray-200);
    }
    ul {
        list-style-type: disc;
        padding-left: 22px;
        display: grid;
        gap: 8px;
    }
    a {
        color: var(--color-blue-300);
    }
    a:hover {
        text-decoration: underline;
        text-underline-offset: 4px;
    }
</style>
