import Scope from "./scope.js";
import { LangObject, LangCode, LangFunction, LangNumber, LangBoolean, LangString } from "./types.js";
import { lex } from "./lexer.js";
import { pass, ParserModes } from "./parser.js";

export default class LangInstance {
    global: Scope;

    constructor(){
        const evalCode = (code: LangCode) => pass(code.context, code.toRawTokens(), ParserModes.SingleExpression);

        this.global = new Scope(undefined, {
            ".": LangCode.EMPTY,
            "+": new LangFunction([{name: "a"}, {name: "b"}], args => {
                let a = args[0], b = args[1];
                if (!(a instanceof LangNumber)){
                    return LangCode.EMPTY; //temp
                }
                if (!(b instanceof LangNumber)){
                    return LangCode.EMPTY;
                }
                return new LangNumber(a.value + b.value);
            }),
            "-": new LangFunction([{name: "a"}, {name: "b"}], args => {
                let a = args[0], b = args[1];
                if (!(a instanceof LangNumber)){
                    return LangCode.EMPTY; //temp
                }
                if (!(b instanceof LangNumber)){
                    return LangCode.EMPTY;
                }
                return new LangNumber(a.value - b.value);
            }),
            "*": new LangFunction([{name: "a"}, {name: "b"}], args => {
                let a = args[0], b = args[1];
                if (!(a instanceof LangNumber)){
                    return LangCode.EMPTY; //temp
                }
                if (!(b instanceof LangNumber)){
                    return LangCode.EMPTY;
                }
                return new LangNumber(a.value * b.value);
            }),
            "/": new LangFunction([{name: "a"}, {name: "b"}], args => {
                let a = args[0], b = args[1];
                if (!(a instanceof LangNumber)){
                    return LangCode.EMPTY; //temp
                }
                if (!(b instanceof LangNumber)){
                    return LangCode.EMPTY;
                }
                return new LangNumber(a.value / b.value);
            }),
            ">": new LangFunction([{name: "a"}, {name: "b"}], args => {
                let a = args[0], b = args[1];
                if (!(a instanceof LangNumber)){
                    return LangCode.EMPTY; //temp
                }
                if (!(b instanceof LangNumber)){
                    return LangCode.EMPTY;
                }
                return a.value > b.value ? LangBoolean.TRUE : LangBoolean.FALSE;
            }),
            "<": new LangFunction([{name: "a"}, {name: "b"}], args => {
                let a = args[0], b = args[1];
                if (!(a instanceof LangNumber)){
                    return LangCode.EMPTY; //temp
                }
                if (!(b instanceof LangNumber)){
                    return LangCode.EMPTY;
                }
                return a.value < b.value ? LangBoolean.TRUE : LangBoolean.FALSE;
            }),
            ">=": new LangFunction([{name: "a"}, {name: "b"}], args => {
                let a = args[0], b = args[1];
                if (!(a instanceof LangNumber)){
                    return LangCode.EMPTY; //temp
                }
                if (!(b instanceof LangNumber)){
                    return LangCode.EMPTY;
                }
                return a.value >= b.value ? LangBoolean.TRUE : LangBoolean.FALSE;
            }),
            "<=": new LangFunction([{name: "a"}, {name: "b"}], args => {
                let a = args[0], b = args[1];
                if (!(a instanceof LangNumber)){
                    return LangCode.EMPTY; //temp
                }
                if (!(b instanceof LangNumber)){
                    return LangCode.EMPTY;
                }
                return a.value <= b.value ? LangBoolean.TRUE : LangBoolean.FALSE;
            }),
            "==": new LangFunction([{name: "a"}, {name: "b"}], args => {
                let a = args[0], b = args[1];
                if (!(a instanceof LangNumber)){
                    return LangCode.EMPTY; //temp
                }
                if (!(b instanceof LangNumber)){
                    return LangCode.EMPTY;
                }
                return a.value === b.value ? LangBoolean.TRUE : LangBoolean.FALSE;
            }),
            "eval": new LangFunction([{name: "code"}], args => {
                let code = args[0];
                if (code.type === "code"){
                    return evalCode(code);
                }
                return LangCode.EMPTY; //temp
            }),
            "while": new LangFunction([{name: "condition", modifier: "@"}, {name: "action", modifier: "@"}], args => {
                let cond = args[0] as LangCode, action = args[1] as LangCode;
                while (true){
                    let condResult = evalCode(cond);
                    if (condResult.type !== "boolean"){
                        break; // throw error eventually
                    }
                    else if (condResult.value){
                        evalCode(action);
                    }
                    else{
                        break;
                    }
                }
                return LangCode.EMPTY;
            }),
            "if": new LangFunction([{name: "condition"}, {name: "then", modifier: "@"}, {name: "otherwise", modifier: "@"}], args => {
                let cond = args[0] as LangBoolean, then = args[1] as LangCode, otherwise = args[2] as LangCode;
                if (cond === LangBoolean.TRUE){
                    return evalCode(then);
                }
                else{
                    return evalCode(otherwise);
                }
            }),
            "at": new LangFunction([{name: "code"}, {name: "index"}], args => {
                let code = args[0];
                let index = args[1];
                if (code.type === "code" && index.type === "number" && code.code.length > index.value){
                    return new LangCode(code.context, [code.code[index.value]]);
                }
                return LangCode.EMPTY; //temp
            }),
            "len": new LangFunction([{name: "code"}], args => {
                let code = args[0];
                if (code.type === "code"){
                    return new LangNumber(code.code.length);
                }
                return LangCode.EMPTY; //temp
            }),
            "print": new LangFunction([{name: "x"}], args => {
                let x = args[0];
                console.log(x instanceof LangString ? x.value : x.toString());
                return LangCode.EMPTY;
            }),
            "===": new LangFunction([{name: "a", modifier: '@'}, {name: "b", modifier: '@'}], args => {
                let a: LangCode = args[0] as LangCode, b: LangCode = args[1] as LangCode;
                let obj1 = evalCode(a), obj2 = evalCode(b);
                return obj1 === obj2 ? LangBoolean.TRUE : LangBoolean.FALSE;
            }),
        });
    }

    evalString(code: string): LangObject {
        let tokens = lex(code);
        return pass(this.global, tokens);
    }
}