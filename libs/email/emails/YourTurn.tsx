import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Section,
    Tailwind,
    Text,
} from '@react-email/components'

interface YourTurnProps {
    title: string
    gameName: string
    url?: string
}

export const YourTurn = ({ title, gameName, url = `` }: YourTurnProps) => {
    const previewText = `It's your turn in your ${title} game ${gameName}`

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-[#f3f4f6] my-0 mx-auto font-sans">
                    <Container className="my-[32px] mx-auto p-[24px] bg-white border border-[#e5e7eb]">
                        <Section className="mb-[16px]">
                            <Text className="text-[12px] uppercase tracking-[1.5px] text-[#6b7280] m-0">
                                Your Turn
                            </Text>
                            <Heading className="text-[#0f172a] my-[8px] mx-0 text-[28px] p-0 leading-[1.2]">
                                It's your move
                            </Heading>
                            <Text className="text-[#475569] text-[15px] leading-[1.6] m-0">
                                The other players are waiting on you. Jump back in and keep the
                                game moving.
                            </Text>
                        </Section>

                        <Section className="bg-[#f8fafc] border border-[#e2e8f0] px-[16px] py-[14px] mb-[20px]">
                            <Text className="text-[13px] uppercase tracking-[1px] text-[#64748b] m-0">
                                Game
                            </Text>
                            <Text className="text-[#0f172a] text-[18px] font-semibold m-0">
                                {title}
                            </Text>
                            <Text className="text-[#475569] text-[14px] m-0">
                                {gameName}
                            </Text>
                        </Section>

                        <Section className="text-center mb-[16px]">
                            <Link
                                href={url}
                                className="bg-[#0f172a] text-white no-underline px-[18px] py-[12px] rounded-[6px] inline-block text-[14px]"
                            >
                                Take your turn
                            </Link>
                        </Section>

                        <Text className="text-[#64748b] text-[12px] leading-[1.6] m-0">
                            If the button does not work, copy and paste this link into your
                            browser: <span className="text-[#0f172a]">{url}</span>
                        </Text>

                        <Text className="text-[#9ca3af] text-[12px] leading-[1.6] mt-[16px] mb-0">
                            You're receiving this because it's your turn in an active game. You
                            won't get another email for this turn unless it stays open for a
                            while.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}

YourTurn.PreviewProps = {
    title: '4d chess',
    gameName: "Bob's Game of 4D Chess",
    url: '#',
} as YourTurnProps

export default YourTurn
