import { CompanyId } from '@tabletop/rocky-ventures'

// Matches the railroad banners on the printed cards (the share art is recoloured to match).
// Colour-blind players should use the colour-blind palette below: these blue/magenta and
// orange/green pairs are close for them.
const StandardColors: Record<CompanyId, string> = {
    [CompanyId.WizardCannonball]: '#176fb4',
    [CompanyId.DwarvenPacific]: '#de621e',
    [CompanyId.GoblinCentral]: '#4dbf70',
    [CompanyId.WingedWyrm]: '#b41766'
}

const StandardTextColors: Record<CompanyId, string> = {
    [CompanyId.WizardCannonball]: '#ffffff',
    [CompanyId.DwarvenPacific]: '#000000',
    [CompanyId.GoblinCentral]: '#000000',
    [CompanyId.WingedWyrm]: '#ffffff'
}

// With the colour-blind palette on, the railroads use Okabe-Ito colours: the standard blue and
// pink are hard to tell apart for many colour-blind players, so Winged Wyrm becomes yellow.
const ColorBlindColors: Record<CompanyId, string> = {
    [CompanyId.WizardCannonball]: '#0072b2',
    [CompanyId.DwarvenPacific]: '#e69f00',
    [CompanyId.GoblinCentral]: '#009e73',
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
