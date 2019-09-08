import Scope from "./scope.js";
import { Token, isToken, TokenBase, StringToken } from "./lexer.js";

export type LangObject = LangString | LangNumber | LangCode | LangFunction | LangBoolean;
export const isLangObject = (obj: any): obj is LangObject => {
    return obj instanceof LangString
    || obj instanceof LangNumber
    || obj instanceof LangCode
    || obj instanceof LangFunction;
}

export class LangString {
    public type: "string" = "string";
    public value: string;

    constructor(value: string){
        this.value = value;
    }

    public toString(): string{
        return `"${this.value}"`;
    }
}

export class LangNumber {
    public type: "number" = "number";
    public value: number;

    constructor(value: number){
        this.value = value;
    }

    public toString(): string{
        return `${this.value}`;
    }
}

export class LangBoolean {
    public type: "boolean" = "boolean";
    public value: boolean;

    private constructor(value: boolean){
        this.value = value;
    }

    public toString(): string{
        return this.value ? "true" : "false";
    }
    public static TRUE: LangBoolean = new LangBoolean(true);
    public static FALSE: LangBoolean = new LangBoolean(false);
}

export interface Block extends TokenBase {
    type: "block";
    value: Token[];
}

export class LangCode {
    public type: "code" = "code";
    public context: Scope;
    public code: (Token | Block | LangCode)[];

    get col(): number { return this.code[0].col; }
    get line(): number { return this.code[0].line; }

    constructor(context: Scope, code: (Token | Block | LangCode)[]){
        this.code = code;
        this.context = context;
    }

    public relocate(context: Scope, loc: {line: number, col: number}): LangCode {
        return new LangCode(context, this.code.map(x => {
            if (x.type === "block"){
                return {
                    ...x,
                    value: x.value.map(y => ({
                        ...y,
                        line: loc.line,
                        col: loc.col
                    })),
                    line: loc.line,
                    col: loc.col
                };
            }
            else if (isToken(x)){
                return {
                    ...x,
                    line: loc.line,
                    col: loc.col
                };
            }
            else if (x.type === "code"){
                return x.relocate(context, loc);
            }
            else{
                return LangCode.EMPTY;
            }
        }));
    }

    public toRawTokens(): Token[] {
        return this.code.reduce((prev: Token[], current) => [
            ...prev,
            ...(current.type === "block"
                ? current.value
                : current.type === "code"
                ? current.toRawTokens()
                : [current])
        ], []);
    }

    public toString(): string{
        return `@(${this.code.map(x => isLangObject(x) ? x.toString() : x.value).join(" ")})`;
    }

    public static EMPTY: LangCode = new LangCode(new Scope(), []);
}

export class LangFunction {
    public type: "function" = "function";
    public params: {name: string, modifier?: '@'}[];
    public body: LangCode | ((args: LangObject[], context: Scope) => LangObject);

    constructor(args: {name: string, modifier?: '@'}[], body: LangCode | ((args: LangObject[], context: Scope) => LangObject)){
        this.params = args;
        this.body = body;
    }

    public toString(): string{
        return `fun (${this.params.map(x => (x.modifier || "") + x.name).join(' ')}) ${this.body.toString().slice(1)}`;
    }

    public static MKFUN: LangFunction = new LangFunction([{name: "args", modifier: '@'}, {name: "body", modifier: '@'}], (args: LangObject[]) => {
        let funArgs = (args[0] as LangCode).code;
        funArgs.filter(x => x.type !== "name" && (x.type !== "code" || x.code.length !== 1 || x.code[0].type !== "name"))
            .forEach(x => { 
                throw new LangError(<Token>x, "Invalid parameter name") });
        return new LangFunction(funArgs.map((x, i) => ({
            name: x.type === "code" ? (<StringToken>x.code[0]).value : (<StringToken>x).value,
            modifier: x.type === "code" ? '@' : undefined
        })), args[1] as LangCode);
    });
    public static IDENTITY: LangFunction = new LangFunction([{name: "x"}], args => args[0]);
}

export class LangError {
    public type: "error" = "error";
    public message: string;
    public pos: {line: number, col: number};

    constructor(pos: {line: number, col: number}, message: string){
        this.message = message;
        this.pos = pos;
    }

    public toString(): string{
        return `ERROR at ${this.pos.line}:${this.pos.col}; ${this.message}`;
    }
}