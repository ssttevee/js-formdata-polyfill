type DataEntry = [string, string | Blob, string | undefined];
type IncompleteEntry = [string | Blob, string | undefined];
type LookupTable = { [name: string]: number[] };

function normalizeEntry(entry: DataEntry | IncompleteEntry): FormDataEntryValue {
    const [value, filename] = entry.slice(-2) as IncompleteEntry;
    return value instanceof Blob ? new File([value], filename || '', { type: value.type }) : value;
}

const $$entries = Symbol('entries');
const $$table = Symbol('table');

export default class implements FormData {
    private [$$entries]: DataEntry[] = [];
    private [$$table]: LookupTable = {};

    constructor(form: HTMLFormElement) {
        if (!form) {
            return;
        }

        for (const elem of form.elements as any as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>) {
            if (!elem.name || elem.disabled) {
                continue;
            }

            switch (elem.type) {
                case 'submit':
                case 'button':
                    continue;

                case 'file':
                    if ((elem as HTMLInputElement).files && (elem as HTMLInputElement).files!.length) {
                        for (const file of (elem as HTMLInputElement).files!) {
                            this.append(elem.name, file);
                        }
                    } else {
                        this.append(elem.name, new File([], '', { type: 'application/octet-stream' }));
                    }

                    continue;

                case 'select-multiple':
                case 'select-one':
                    for (const option of (elem as HTMLSelectElement).options) {
                        if (!option.disabled && option.selected) {
                            this.append(elem.name, option.value);
                        }
                    }

                    continue;

                case 'checkbox':
                case 'radio':
                    if ((elem as HTMLInputElement).checked) {
                        this.append(elem.name, elem.value);
                    }

                    continue;
            }

            this.append(
                elem.name,

                // normalize linefeeds for textareas
                // https://html.spec.whatwg.org/multipage/form-elements.html#textarea-line-break-normalisation-transformation
                elem.type === 'textarea' ? elem.value.replace(/(?:([^\r])\n|\r([^\n]))/g, '$1\r\n$2') : elem.value,
            );
        }
    }

    public append(name: string, value: string | Blob, filename?: string) {
        if (!(name in this[$$table])) {
            this[$$table][name] = [this[$$entries].length];
        } else {
            this[$$table][name].push(this[$$entries].length);
        }

        this[$$entries].push([name, value, filename]);
    }

    public delete(name: string): void {
        for (let index: number | undefined; (index = this[$$table][name].pop()) !== undefined;) {
            this[$$entries].splice(index, 1);
        }
    }

    public get(name: string): FormDataEntryValue | null {
        for (const index of this[$$table][name]) {
            return normalizeEntry(this[$$entries][index]);
        }

        return null;
    }

    public getAll(name: string): FormDataEntryValue[] {
        return this[$$table][name].map((index) => normalizeEntry(this[$$entries][index]));
    }

    public has(name: string): boolean {
        return this[$$table][name] && this[$$table][name].length > 0;
    }

    public set(name: string, value: string | Blob, filename?: string): void {
        this.delete(name);
        this.append(name, value, filename);
    }

    public forEach(callbackfn: (value: FormDataEntryValue, key: string, parent: FormData) => void, thisArg?: any): void {
        for (const [name, ...entry] of this[$$entries]) {
            Function.prototype.call.call(callbackfn, thisArg, normalizeEntry(entry), name, this);
        }
    }

    public *[Symbol.iterator](): IterableIterator<[string, FormDataEntryValue]> {
        yield* this[$$entries].map(([name, ...entry]): [string, FormDataEntryValue] => [name, normalizeEntry(entry)]);
    }

    public *entries(): IterableIterator<[string, FormDataEntryValue]> {
        return this[Symbol.iterator]();
    }

    public *keys(): IterableIterator<string> {
        yield* Object.keys(this[$$table]);
    }

    public *values(): IterableIterator<FormDataEntryValue> {
        yield* this[$$entries].map(normalizeEntry);
    }
}
