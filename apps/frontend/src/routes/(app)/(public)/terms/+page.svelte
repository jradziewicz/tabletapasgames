<script lang="ts">
    // Address shown for questions. Change this to whatever you want to publish.
    const CONTACT_EMAIL = 'jradziewicz@gmail.com'
    const LAST_UPDATED = 'September 29, 2026'
</script>

<svelte:head>
    <title>Terms of Service — TableTapas Games</title>
    <meta name="description" content="The rules for using TableTapas Games." />
</svelte:head>

<main class="legal-page collection-page">
    <header class="collection-header">
        <h1 class="collection-heading">Terms of Service</h1>
    </header>
    <p class="updated">Last updated {LAST_UPDATED}</p>

    <p>
        By creating an account or using TableTapas Games at play.tabletapasgames.com (the “site”),
        you agree to these terms. If you do not agree, please do not use the site.
    </p>

    <h2>Using the site</h2>
    <p>
        The site is free and is provided for personal, non-commercial play. You are responsible for
        your account and for keeping your sign-in details secure. You must provide accurate
        information and may not use another person’s account.
    </p>

    <h2>Acceptable behavior</h2>
    <p>Please be a good tablemate. You agree not to:</p>
    <ul>
        <li>harass, threaten or abuse other players, or post unlawful or hateful content;</li>
        <li>cheat, exploit bugs, or use bots or automation to gain an unfair advantage;</li>
        <li>attempt to break, overload or gain unauthorized access to the site or its data;</li>
        <li>copy or scrape the site in ways that harm it or other users.</li>
    </ul>
    <p>
        We may remove content, end games, or suspend or delete accounts that break these rules.
    </p>

    <h2>Your content</h2>
    <p>
        You keep ownership of what you post (such as chat messages). You give us permission to store
        and display it as needed to run the site, including showing it to other players in your
        games.
    </p>

    <h2>Games and software</h2>
    <p>
        The site is built on open source software. Game names, artwork and rules belong to their
        respective owners and are used with permission or under applicable licenses. Nothing here
        transfers ownership of any game or trademark to you.
    </p>

    <h2>No warranty</h2>
    <p>
        The site is provided “as is” and “as available”, without warranties of any kind. We do not
        guarantee that it will be uninterrupted or error-free, or that games and data will never be
        lost.
    </p>

    <h2>Limitation of liability</h2>
    <p>
        To the fullest extent permitted by law, we are not liable for any indirect, incidental or
        consequential damages arising from your use of the site.
    </p>

    <h2>Changes</h2>
    <p>
        We may update these terms from time to time. Continuing to use the site after a change
        means you accept the updated terms.
    </p>

    <h2>Contact</h2>
    <p>
        Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also our
        <a href="/privacy">Privacy Policy</a>.
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
        margin: 8px 0;
    }
    a {
        color: var(--color-blue-300);
    }
    a:hover {
        text-decoration: underline;
        text-underline-offset: 4px;
    }
</style>
