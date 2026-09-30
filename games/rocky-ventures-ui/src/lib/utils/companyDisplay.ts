import { CompanyId } from '@tabletop/rocky-ventures'

export const CompanyColors: Record<CompanyId, string> = {
    [CompanyId.WizardCannonball]: '#3f6fd6',
    [CompanyId.DwarvenPacific]: '#e8892b',
    [CompanyId.GoblinCentral]: '#4a4a4a',
    [CompanyId.WingedWyrm]: '#d55cc9'
}

export const CompanyTextColors: Record<CompanyId, string> = {
    [CompanyId.WizardCannonball]: '#ffffff',
    [CompanyId.DwarvenPacific]: '#000000',
    [CompanyId.GoblinCentral]: '#ffffff',
    [CompanyId.WingedWyrm]: '#000000'
}
