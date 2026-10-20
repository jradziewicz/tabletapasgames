import { Section, Text } from '@react-email/components'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkStyles as styles,
} from '../components/darkCard.js'

interface YourTurnProps {
    title: string
    gameName: string
    url?: string
}

export const YourTurn = ({ title, gameName, url = `` }: YourTurnProps) => (
    <DarkCardEmail
        preview={`It's your turn in your ${title} game ${gameName}`}
        wordmarkHref={url}
        heading="It's your move"
        subline="The other players are waiting on you. Jump back in and keep the game moving."
        footer={
            <>
                You're receiving this because it's your turn in an active game. You won't get
                another email for this turn unless it stays open for a while.{' '}
                <ButtonFallback url={url} />
            </>
        }
    >
        <Section style={styles.panel}>
            <Text style={styles.panelValue}>{gameName}</Text>
            <Text style={styles.panelDetail}>{title}</Text>
        </Section>
        <CardButton href={url}>Take your turn</CardButton>
    </DarkCardEmail>
)

YourTurn.PreviewProps = {
    title: '4d chess',
    gameName: "Bob's Game of 4D Chess",
    url: 'https://play.tabletapasgames.com/game/qidEk1NjzIRBEioOpoCGD',
} satisfies YourTurnProps

export default YourTurn
