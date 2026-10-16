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

export interface BugReportDetail {
    label: string
    value: string
}

interface BugReportFiledProps {
    reporterName: string
    title: string
    gameName: string
    description: string
    details: BugReportDetail[]
    gameUrl?: string
    adminUrl?: string
}

export const BugReportFiled = ({
    reporterName,
    title,
    gameName,
    description,
    details,
    gameUrl = ``,
    adminUrl = ``,
}: BugReportFiledProps) => {
    const previewText = `${reporterName} reported a bug in ${title}`

    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-[#f3f4f6] my-0 mx-auto font-sans">
                    <Container className="my-[32px] mx-auto p-[24px] bg-white border border-[#e5e7eb]">
                        <Section className="mb-[16px]">
                            <Text className="text-[12px] uppercase tracking-[1.5px] text-[#6b7280] m-0">
                                Bug Report
                            </Text>
                            <Heading className="text-[#0f172a] my-[8px] mx-0 text-[28px] p-0 leading-[1.2]">
                                {reporterName} reported a bug
                            </Heading>
                            <Text className="text-[#475569] text-[15px] leading-[1.6] m-0 whitespace-pre-wrap">
                                {description}
                            </Text>
                        </Section>

                        <Section className="bg-[#f8fafc] border border-[#e2e8f0] px-[16px] py-[14px] mb-[20px]">
                            <Text className="text-[13px] uppercase tracking-[1px] text-[#64748b] m-0">
                                Game
                            </Text>
                            <Text className="text-[#0f172a] text-[18px] font-semibold m-0">
                                {title}
                            </Text>
                            <Text className="text-[#475569] text-[14px] m-0">{gameName}</Text>
                        </Section>

                        <Section className="mb-[20px]">
                            {details.map((detail) => (
                                <Text
                                    key={detail.label}
                                    className="text-[#475569] text-[13px] leading-[1.5] my-[2px] mx-0"
                                >
                                    <span className="text-[#64748b]">{detail.label}:</span>{' '}
                                    <span className="text-[#0f172a]">{detail.value}</span>
                                </Text>
                            ))}
                        </Section>

                        <Section className="text-center mb-[16px]">
                            <Link
                                href={gameUrl}
                                className="bg-[#7165ad] text-white no-underline px-[18px] py-[12px] rounded-[6px] inline-block text-[14px]"
                            >
                                Open the game in host view
                            </Link>
                        </Section>

                        <Text className="text-[#64748b] text-[12px] leading-[1.6] m-0">
                            If the button does not work, copy and paste this link into your
                            browser: <span className="text-[#0f172a]">{gameUrl}</span>
                        </Text>

                        <Text className="text-[#9ca3af] text-[12px] leading-[1.6] mt-[16px] mb-0">
                            You're receiving this because you are a site admin. Close the report
                            from the Bug reports tab of the{' '}
                            <Link href={adminUrl} className="text-[#7165ad]">
                                Admin page
                            </Link>
                            .
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}

BugReportFiled.PreviewProps = {
    reporterName: 'bobsmith27',
    title: '4d chess',
    gameName: "Bob's Game of 4D Chess",
    description: 'The knight would not move.\nI clicked it twice and nothing happened.',
    details: [
        { label: 'Seat', value: 'bobsmith27' },
        { label: 'Actions', value: '42' },
        { label: 'Viewing', value: 'Live' },
    ],
    gameUrl: '#',
    adminUrl: '#',
} as BugReportFiledProps

export default BugReportFiled
