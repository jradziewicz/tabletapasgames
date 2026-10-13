import { CompanyId } from '@tabletop/rocky-ventures'

const StandardColors: Record<CompanyId, string> = {
    [CompanyId.WizardCannonball]: '#3f6fd6',
    [CompanyId.DwarvenPacific]: '#e8892b',
    [CompanyId.GoblinCentral]: '#4a4a4a',
    [CompanyId.WingedWyrm]: '#d55cc9'
}

const StandardTextColors: Record<CompanyId, string> = {
    [CompanyId.WizardCannonball]: '#ffffff',
    [CompanyId.DwarvenPacific]: '#000000',
    [CompanyId.GoblinCentral]: '#ffffff',
    [CompanyId.WingedWyrm]: '#000000'
}

// With the colour-blind palette on, the railroads use Okabe-Ito colours: the standard blue and
// pink are hard to tell apart for many colour-blind players, so Winged Wyrm becomes yellow.
const ColorBlindColors: Record<CompanyId, string> = {
    [CompanyId.WizardCannonball]: '#0072b2',
    [CompanyId.DwarvenPacific]: '#e69f00',
    [CompanyId.GoblinCentral]: '#4a4a4a',
    [CompanyId.WingedWyrm]: '#f0e442'
}

const ColorBlindTextColors: Record<CompanyId, string> = {
    [CompanyId.WizardCannonball]: '#ffffff',
    [CompanyId.DwarvenPacific]: '#000000',
    [CompanyId.GoblinCentral]: '#ffffff',
    [CompanyId.WingedWyrm]: '#000000'
}

let colorBlind = $state(false)

// Called by GameTable with the viewer's colour-blind palette preference.
export function setCompanyColorBlind(value: boolean) {
    colorBlind = value
}

function byPreference(standard: Record<CompanyId, string>, colorBlindSet: Record<CompanyId, string>) {
    const colors = {} as Record<CompanyId, string>
    for (const id of Object.values(CompanyId)) {
        Object.defineProperty(colors, id, {
            enumerable: true,
            get: () => (colorBlind ? colorBlindSet[id] : standard[id])
        })
    }
    return colors
}

// Read reactively: each lookup follows the current palette.
export const CompanyColors = byPreference(StandardColors, ColorBlindColors)
export const CompanyTextColors = byPreference(StandardTextColors, ColorBlindTextColors)
