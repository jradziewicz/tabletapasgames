import { Section, Text } from '@react-email/components'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkStyles as styles,
} from '../components/darkCard.js'

interface VoteRequestedProps {
    title: string
    gameName: string
    // "Ana asks to go back" / "Ana asks to end the game"
    request: string
    url?: string
}

// Sent to the other players when someone asks for a vote (a rewind, or calling the game).
export const VoteRequested = ({ title, gameName, request, url = `` }: VoteRequestedProps) => (
    <DarkCardEmail
        preview={`${request} in your ${title} game ${gameName}`}
        wordmarkHref={url}
        heading={request}
        subline="The game is waiting on your vote. Open it to approve or decline."
        footer={
            <>
                You're receiving this because a player in one of your games asked for a vote.{' '}
                <ButtonFallback url={url} />
            </>
        }
    >
        <Section style={styles.panel}>
            <Text style={styles.panelValue}>{gameName}</Text>
            <Text style={styles.panelDetail}>{title}</Text>
        </Section>
        <CardButton href={url}>Vote now</CardButton>
    </DarkCardEmail>
)

VoteRequested.PreviewProps = {
    title: 'Rocky Ventures',
    gameName: "Bob's game",
    request: 'Bob asks to go back',
    url: 'https://play.tabletapasgames.com/game/qidEk1NjzIRBEioOpoCGD',
} satisfies VoteRequestedProps

export default VoteRequested
