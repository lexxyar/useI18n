import axios from "axios";
import {QueryBuilder} from "@lexxsoft/odata-query";
import {ref, App, Ref} from "vue";

export interface II18nServiceOptions {
    translationUrl?: string
    langUrlQueryParameterName?: string
    messages?: object
}

class ChoiceStruct {
    low: number = 0
    high: number = 0
    raw: string = ''
    exact: boolean = false
    interval: boolean = false
    result: string = ''
}

class I18nService {
    private static instance: I18nService | null = null
    private _loadedLanguages: { [key: string]: any } = {} // our default language that is preloaded

    get locale(): string {
        const htmlTag: HTMLHtmlElement = document.querySelector('html') as HTMLHtmlElement
        return htmlTag.getAttribute('lang') || 'en'
    }

    set locale(value: string) {
        const htmlTag: HTMLHtmlElement = document.querySelector('html') as HTMLHtmlElement
        htmlTag.setAttribute('lang', value)
        i18n.global.locale.value = value
        if (Object.keys(this._loadedLanguages).includes(value)) {
            i18n.global.setLocaleMessage(value, this._loadedLanguages[value])
        } else {
            throw Error(`Translations for language ${value} is not loaded yet. Call 'i18nService.loadTranslations("${value}")' to load them.`)
        }
    }

    public constructor() {
        if (I18nService.instance !== null) {
            return I18nService.instance;
        }

        I18nService.instance = this;

        return this;
    }

    private prepareUrl(lang: string): string {
        const oBuilder = new QueryBuilder(i18n.global.remoteTranslationsUrl.value)
        oBuilder.querySet(i18n.global.remoteLangParameterName.value, lang)
        return oBuilder.build()
    }

    private setTranslation(lang: string, data: any): void {
        this._loadedLanguages[lang] = data
        this.locale = lang
    }

    public async loadTranslations(lang: string, force: boolean = false): Promise<any> {
        if (!i18n.global.remoteTranslationsUrl.value) return Promise.resolve()
        if (Object.keys(this._loadedLanguages).includes(lang) && !force) return Promise.resolve()

        const response = await axios.get(this.prepareUrl(lang))
        this.setTranslation(lang, response.data)
    }

    public loadTranslationsSync(lang: string, force: boolean = false) {
        if (!i18n.global.remoteTranslationsUrl.value) return;
        if (Object.keys(this._loadedLanguages).includes(lang) && !force) return;

        let xhr: XMLHttpRequest = new XMLHttpRequest()
        xhr.open('GET', this.prepareUrl(lang), false)
        xhr.send()

        if (xhr.status != 200) {
            throw Error(`Error ${xhr.status}: ${xhr.statusText}`)
        }
        const data: any = JSON.parse(xhr.response)
        this.setTranslation(lang, data)
    }
}

const i18nService = new I18nService()

export const i18n = {
    global: {
        remoteTranslationsUrl: ref(''),
        remoteLangParameterName: ref('lang'),
        messages: ref({}) as Ref<any>,
        locale: ref(i18nService.locale),
        fallbackLocale: ref('en'),
        setLocaleMessage: (locale: string, messages: any) => {
            i18n.global.locale.value = locale
            i18n.global.messages.value[locale] = {...messages}
        },
        trans: (key: string, options: any = {}): string => {
            function substituteOptions(translation: string, options: any) {
                let res: string = translation
                if (!!options && Object.keys(options).length > 0) {
                    Object.keys(options).map((attr: string) => {
                        res = res?.replaceAll(`{${attr}}`, options[attr])
                    })
                }
                return res
            }

            let messages: any = {}
            if (!!i18n.global.messages.value[i18n.global.locale.value]) {
                messages = i18n.global.messages.value[i18n.global.locale.value]
            } else {
                if (!!i18n.global.messages.value[i18n.global.fallbackLocale.value]) {
                    messages = i18n.global.messages.value[i18n.global.fallbackLocale.value]
                } else {
                    console.warn(`Translation for ${key} not found`)
                    return substituteOptions(key, options)
                }
            }


            function wordsCount(str: string): number {
                return str.split(' ')
                    .filter(function (n) {
                        return n != ''
                    })
                    .length;
            }

            let translation: string | undefined
            if (wordsCount(key) > 1) {
                translation = messages[key] ?? key
            } else {
                translation = key.split('.')
                    .reduce((o: any, i: string) => {
                        if (o) return o[i]
                    }, messages)
            }

            translation = translation ?? key

            return substituteOptions(translation, options)
        },
        trans_choice: (key: string, count: number, options: any = {}): string => {
            let translation: string = i18n.global.trans(key, options)
            console.log(translation)
            const choiceItems: ChoiceStruct[] = []
            translation.split('|')
                .map((item: string) => {
                    const struct: ChoiceStruct = new ChoiceStruct()
                    struct.raw = item
                    const exactMatch = item.match(/\{\d+}/gm)
                    struct.exact = exactMatch ? exactMatch.length > 0 : false

                    const intervalMatch = item.match(/\[\d+/gm)
                    struct.interval = intervalMatch ? intervalMatch.length > 0 : false

                    if (struct.exact) {
                        const regex = /\{(?<low>\d+)}/gm;
                        let match;
                        if ((match = regex.exec(item)) !== null) {
                            if (!!match.groups && !!match.groups.low) {
                                struct.low = struct.high = +match.groups.low
                            }
                            struct.result = item.replace(match[0], '').trim()
                        }
                    } else if (struct.interval) {
                        const regex = /\[(?<low>\d+),\s*(?<high>[*\d]+)]/gm;
                        let match;
                        if ((match = regex.exec(item)) !== null) {
                            if (!!match.groups) {
                                struct.low = +match.groups.low
                                if (!!match.groups.high) {
                                    if (match.groups.high === '*') {
                                        struct.high = Number.MAX_SAFE_INTEGER
                                    } else {
                                        struct.high = +match.groups.high
                                    }
                                }
                            }
                            struct.result = item.replace(match[0], '').trim()
                        }
                    }
                    choiceItems.push(struct)
                })

            choiceItems
                .filter((e: ChoiceStruct) => !e.exact && !e.interval)
                .forEach((v: ChoiceStruct, i: number, a: ChoiceStruct[]) => {
                    v.low = v.high = i + 1
                    v.result = v.raw
                    if (a.length === i + 1) {
                        v.high = Number.MAX_SAFE_INTEGER
                    }
                })

            const found = choiceItems.find((e: ChoiceStruct) => e.low <= count && count <= e.high)
            if (found) {
                return found.result
            }

            return translation
        }
    },
    install(app: App, options: Partial<II18nServiceOptions> = {}) {
        i18n.global.remoteTranslationsUrl.value = options.translationUrl ?? ''
        i18n.global.remoteLangParameterName.value = options.langUrlQueryParameterName ?? 'lang'
        i18n.global.messages.value = options.messages ?? {}
        i18nService.loadTranslationsSync(i18nService.locale);
    }
}

export const useI18n = function () {
    const t = (key: string, options: object = {}) => {
        return i18n.global.trans(key, options)
    }
    const tc = (key: string, count: number, options: object = {}) => {
        return i18n.global.trans_choice(key, count, options)
    }

    const setLocale = (locale: string) => {
        i18nService.loadTranslations(locale)
    }
    const setLocaleSync = (locale: string) => {
        i18nService.loadTranslationsSync(locale)
    }

    return {
        t,
        tc,
        setLocale,
        setLocaleSync,
    }
}
