import { LangObject } from "./types.js";
import { NameToken } from "./lexer.js";

export default class Scope {
    public parent?: Scope;
    public mappings: {[name: string]: LangObject};

    constructor(parent?: Scope, mappings?: {[name: string]: LangObject}){
        this.parent = parent;
        this.mappings = mappings || {};
    }

    get(token: NameToken): LangObject | undefined{
        let mapping = this.mappings[token.value];
        if (mapping){
            return mapping;
        }
        else if (this.parent !== undefined){
            return this.parent.get(token);
        }
        else{
            return;
        }
    }

    define(token: NameToken, value: LangObject): boolean{
        if (this.mappings[token.value]){
            return false;
        }
        this.mappings[token.value] = value;
        return true;
    }

    set(token: NameToken, value: LangObject): boolean{
        if (this.mappings[token.value]){
            this.mappings[token.value] = value;
            return true;
        }
        else if (this.parent !== undefined){
            return this.parent.set(token, value);
        }
        else{
            return false;
        }
    }
}