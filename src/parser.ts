import { StringToken, Token, NumberToken, BracketToken, SpecialToken } from "./lexer.js";
import { LangObject, LangFunction, LangString, LangNumber, LangError, LangCode, Block } from "./types.js";
import { Stack } from "./utility.js";
import Scope from "./scope.js";

export const parseString = (token: StringToken) => new LangString(token.value);
export const parseNumber = (token: NumberToken) => new LangNumber(token.value);

export enum ParserModes {
    None = 0,
    SingleExpression = 1,
    NoFinalPropagate = 2
}

export const pass = (context: Scope, tokens: Token[], mode: ParserModes = ParserModes.None): LangObject => {
    let singleExpression = (mode & ParserModes.SingleExpression) > 0;
    let noFinalPropagate = (mode & ParserModes.NoFinalPropagate) > 0;
    
    let applyStack = new Stack<{callSite: Token, func: LangFunction, argList: LangObject[], meta?: {type: string, data: any}}>();
    let nextCallMeta: {type: string, data: any} | undefined;
    let lastOutputValue: LangObject | undefined;

    let dontTryCall = false;

    const raiseError = (error: LangError) => 
        console.error(error.toString());
    const logBadToken = (token: Token) =>
        raiseError(new LangError(token, `Unexpected token '${token.value}'`));

    const getBracketContents = (start: number, customTokenList?: Token[]): Token[] | undefined => {
        let _tokens = customTokenList || tokens;
        let shape: "curved" | "curly" = (<BracketToken>_tokens[start]).shape;
        let toClose = 1;
        let i = start;
        while (toClose > 0){
            if (++i >= _tokens.length){
                return undefined;
            }
            else if (_tokens[i].type === "bracket" && (<BracketToken>_tokens[i]).shape === shape){
                toClose += (<BracketToken>_tokens[i]).facing === "left" ? 1 : -1;
            }
        }
        return _tokens.slice(start+1, i);
    }

    const processHash = (code: LangObject, cycles: number, loc: {line: number, col: number}): Token[] => {
        if (code.type !== "code"){
            raiseError(new LangError(loc, `The '#' operator expected code, got ${code.toString()}`));
            return [];
        }
        let result = code.relocate(context, loc).toRawTokens();
        while (--cycles > 0){
            let obj = pass(context, result, ParserModes.SingleExpression);
            if (obj.type === "code"){
                result = obj.relocate(context, loc).toRawTokens();
            }
            else {
                raiseError(new LangError(loc, `The '#' operator expected code, got ${obj.toString()}`));
            }
        }
        return result;
    }

    const processStash = (stashedTokens: (Token | Block | LangCode)[]): (Token | Block | LangCode)[] => {
        let newStash: (Token | Block | LangCode)[] = [];
        let stashCount = 0;
        let firstLoc: {line: number, col: number} | undefined;
        for (let i = 0; i < stashedTokens.length; i++){
            let token = stashedTokens[i];
            if (token.type === "special"){
                if (firstLoc === undefined){
                    firstLoc = token;
                }
                switch(token.value){
                    case '@':
                        stashCount++;
                        break;
                    case '#':
                        stashCount--;
                        break;
                    default:
                        logBadToken(token);
                }
            }
            else {
                if (firstLoc === undefined){
                    if (token.type === "bracket"){
                        if (token.facing === "left"){
                            let contents = getBracketContents(i, <Token[]>stashedTokens);
                            if (contents !== undefined){
                                if (token.shape === "curly"){
                                    newStash.push({...token, type: "block", value: [
                                        <BracketToken>stashedTokens[i],
                                        ...contents,
                                        <BracketToken>stashedTokens[i + contents.length + 1]
                                    ]});
                                }
                                else{
                                    newStash.push(token, ...contents, stashedTokens[i + contents.length + 1])
                                }
                                i += contents.length + 1;
                            }
                            else{
                                raiseError(new LangError(token, `No matching closing bracket`));
                                i = stashedTokens.length;
                            }
                        }
                        else{
                            logBadToken(token);
                        }
                    }
                    else{
                        newStash.push(token);
                    }
                }
                else{
                    if (stashCount > 0){
                        if (token.type === "bracket"){
                            if (token.facing === "left"){
                                let contents = getBracketContents(i, <Token[]>stashedTokens);
                                if (contents !== undefined){
                                    let result = new LangCode(context, token.shape === "curved"
                                        ? contents
                                        : [{...firstLoc, type: "block", value: [tokens[i], ...contents, tokens[i + contents.length + 1]]}]);
                                    while (--stashCount > 0){
                                        result = new LangCode(context, [result]);
                                    }
                                    newStash.push(result);
                                    i += contents.length + 1;
                                }
                                else{
                                    raiseError(new LangError(stashedTokens[i], `No matching closing bracket`));
                                    i = stashedTokens.length;
                                }
                            }
                            else{
                                logBadToken(token);
                            }
                        }
                        else{
                            let result = new LangCode(context, [token]);
                            while (--stashCount > 0){
                                result = new LangCode(context, [result]);
                            }
                            newStash.push(result);
                        }
                    }
                    else if (stashCount < 0){
                        if (token.type === "bracket"){
                            if (token.facing === "left"){
                                let contents = getBracketContents(i, <Token[]>stashedTokens);
                                if (contents !== undefined){
                                    let group = new LangCode(context, token.shape === "curved"
                                        ? contents
                                        : [{...firstLoc, type: "block", value: [tokens[i], ...contents, <Token>stashedTokens[i + contents.length + 1]]}]);
                                    stashedTokens = [
                                        ...stashedTokens.slice(0, i),
                                        ...processHash(group, -stashCount + 1, firstLoc),
                                        ...stashedTokens.slice(i + contents.length + 2, stashedTokens.length)
                                    ];
                                    i--;
                                }
                                else{
                                    raiseError(new LangError(stashedTokens[i], `No matching closing bracket`));
                                    i = stashedTokens.length;
                                }
                            }
                            else{
                                logBadToken(token);
                            }
                        }
                        else{
                            stashedTokens = [
                                ...stashedTokens.slice(0, i),
                                ...processHash(new LangCode(context, [token]), -stashCount + 1, firstLoc),
                                ...stashedTokens.slice(i+1, stashedTokens.length)
                            ];
                            i--;
                        }
                    }

                    firstLoc = undefined;
                    stashCount = 0;
                }
            }
        }
        return newStash;
    }

    let i = 0;

    const handleDiscovered = (primaryToken: Token, discovered: LangObject | undefined) => {
        if (discovered !== undefined){
            if (discovered.type === "function" && !dontTryCall){
                applyStack.push({ callSite: primaryToken, func: discovered, argList: [], meta: nextCallMeta });
            }
            else{
                dontTryCall = false;
                
                if (nextCallMeta && nextCallMeta.type === 'hash'){
                    let replacement = processHash(discovered, nextCallMeta.data, primaryToken);
                    tokens = [...tokens.slice(0, i), ...replacement, ...tokens.slice(i + 1)]
                    i--;
                    discovered = undefined;
                }
                else if (applyStack.length > 0){
                    let topCall = applyStack.peek();
                    topCall.argList.push(discovered);
                    while (applyStack.length > 0 && topCall.argList.length === topCall.func.params.length){
                        if (topCall.func.body instanceof LangCode){
                            discovered = pass(new Scope(topCall.func.body.context, Object.fromEntries(
                                new Array(topCall.func.params.length).fill(undefined)
                                    .map((_, i) => [topCall.func.params[i].name, topCall.argList[i]])
                                )), topCall.func.body.toRawTokens(), ParserModes.SingleExpression);
                        }
                        else{
                            discovered = topCall.func.body(topCall.argList, context);
                        }
                        applyStack.pop();
                        
                        if (topCall.meta){
                            if (topCall.meta.type === 'hash'){
                                let replacement = processHash(discovered, topCall.meta.data, primaryToken);
                                tokens = [...tokens.slice(0, i), ...replacement, ...tokens.slice(i + 1)]
                                i--;
                                discovered = undefined;
                                break;
                            }
                            else if (topCall.meta.type === 'let'){
                                if (discovered === undefined){
                                    raiseError(new LangError(topCall.meta.data, `Expected value, instead got nothing`));
                                }
                                if (!context.define(topCall.meta.data, discovered)){
                                    raiseError(new LangError(topCall.meta.data, `${topCall.meta.data} is already defined`));
                                }
                                break;
                            }
                            else if (topCall.meta.type === 'assign'){
                                if (discovered === undefined){
                                    raiseError(new LangError(topCall.meta.data, `Expected value, instead got nothing`));
                                }
                                if (!context.set(topCall.meta.data, discovered)){
                                    raiseError(new LangError(topCall.meta.data, `${topCall.meta.data} has not been defined`));
                                }
                                break;
                            }
                        }

                        if (discovered.type === "function" && !((singleExpression || noFinalPropagate) && applyStack.length === 0)){
                            applyStack.push({ callSite: primaryToken, func: discovered, argList: [], meta: nextCallMeta })
                        }
                        else{
                            if (applyStack.length === 0){
                                lastOutputValue = discovered;
                            }
                            else{
                                applyStack.peek().argList.push(discovered);
                            }
                        }

                        topCall = applyStack.peek();
                    }
                }
                else if (nextCallMeta){
                    if (nextCallMeta.type === 'let'){
                        if (discovered === undefined){
                            raiseError(new LangError(nextCallMeta.data, `Expected value, instead got nothing`));
                        }
                        if (!context.define(nextCallMeta.data, discovered)){
                            raiseError(new LangError(nextCallMeta.data, `${nextCallMeta.data} is already defined`));
                        }
                    }
                    else if (nextCallMeta.type === 'assign'){
                        if (discovered === undefined){
                            raiseError(new LangError(nextCallMeta.data, `Expected value, instead got nothing`));
                        }
                        if (!context.set(nextCallMeta.data, discovered)){
                            raiseError(new LangError(nextCallMeta.data, `${nextCallMeta.data} has not been defined`));
                        }
                    }
                }
                else {
                    lastOutputValue = discovered || lastOutputValue;
                    if (singleExpression && tokens.length >= i){
                        tokens.slice(i + 1, tokens.length).forEach(x => logBadToken(x));
                        return lastOutputValue;
                    }
                }
            }
            nextCallMeta = undefined;
        }
    }

    for (i = 0; i < tokens.length; i++){
        let token = tokens[i];
        let discovered: LangObject | undefined;

        switch(token.type){
            case "string":
                if (applyStack.length > 0 && applyStack.peek().func.params[applyStack.peek().argList.length].modifier === '@'){
                    discovered = new LangCode(context, [token]);
                }
                else{
                    discovered = parseString(token);
                }
                break;
            case "number":
                if (applyStack.length > 0 && applyStack.peek().func.params[applyStack.peek().argList.length].modifier === '@'){
                    discovered = new LangCode(context, [token]);
                }
                else{
                    discovered = parseNumber(token);
                }
                break;
            case "name":
                if (!(nextCallMeta && nextCallMeta.type === 'hash') && i+1 < tokens.length && tokens[i+1].type === "special" && tokens[i+1].value === '='){
                    if (applyStack.length > 0){
                        if (applyStack.peek().argList.length === 0 && !singleExpression){
                            discovered = applyStack.pop()!.func;
                            dontTryCall = true;
                            i--;
                            break;
                        }
                        else{
                            logBadToken(tokens[i]);
                            logBadToken(tokens[i+1]);
                        }
                    }
                    else{
                        nextCallMeta = {type: 'assign', data: token};
                        i++;
                    }
                    
                }
                else{
                    if (applyStack.length > 0 && applyStack.peek().func.params[applyStack.peek().argList.length].modifier === '@'){
                        discovered = new LangCode(context, [token]);
                    }
                    else{
                        discovered = context.get(token);
                        if (discovered === undefined){
                            raiseError(new LangError(token, `Could not find name ${token.value} in scope.`));
                            discovered = LangCode.EMPTY;
                        }
                    }
                    
                }
                break;
            case "bracket":
                if (token.facing === "right"){
                    if (applyStack.length > 0 && token.shape === "curved" && applyStack.peek().meta && applyStack.peek().meta!.type === 'hash'){
                        raiseError(new LangError(applyStack.peek().callSite, `Expected ${applyStack.peek().func.params.length} arguments, got ${applyStack.peek().argList.length}`));
                        raiseError(new LangError(token, `Function call prematurely terminated`));
                        applyStack.pop();
                        discovered = LangCode.EMPTY;
                    }
                    else{
                        logBadToken(token);
                    }
                }
                else if (token.shape === "curved"){
                    if (applyStack.length > 0 && applyStack.peek().func.params[applyStack.peek().argList.length].modifier === '@'){
                        let contents = getBracketContents(i);
                        if (contents === undefined){
                            raiseError(new LangError(tokens[i], `No matching closing bracket`));
                            i = tokens.length;
                        }
                        else{
                            i += contents.length + 1;
                            discovered = new LangCode(context, processStash(contents));
                        }
                    }
                    else{
                        if (nextCallMeta && nextCallMeta.type === 'hash'){
                            let contents = getBracketContents(i);
                            if (contents === undefined){
                                raiseError(new LangError(tokens[i], `No matching closing bracket`));
                            }
                            else{
                                let code = new LangCode(context, contents);
                                let replacement = processHash(code, nextCallMeta.data, token);
                                tokens = [...tokens.slice(0, i), ...replacement];
                                i--;
                                nextCallMeta = undefined;
                            }
                        }
                        else{
                            raiseError(new LangError(token, `Unexpected token '${token.value}'. Parentheses may only be used for modifier groups`));
                        }
                    }
                }
                else{
                    let contents = getBracketContents(i);
                    if (contents === undefined){
                        raiseError(new LangError(token, `No matching closing bracket`));
                        i = tokens.length;
                    }
                    else{
                        if (applyStack.length > 0 && applyStack.peek().func.params[applyStack.peek().argList.length].modifier === '@'){
                            discovered = new LangCode(context, [{...token, type: "block", value: [tokens[i], ...contents, tokens[i + contents.length + 1]]}]);
                        }
                        else{
                            discovered = pass(new Scope(context), contents, ParserModes.None);
                        }
                        i += contents.length + 1;
                    }
                }
                break;
            case "special":
                if (token.value === '@'){
                    let _processStash: Function = processStash;
                    if (applyStack.length > 0 && applyStack.peek().func.params[applyStack.peek().argList.length].modifier === '@'){
                        _processStash = (tokens: Token[]) => [
                            token,
                            {...token, type: "bracket", facing: "left", shape: "curved", value: '('},
                            ...tokens,
                            {...token, type: "bracket", facing: "right", shape: "curved", value: '('},
                        ];
                    }

                    let additionalContents: Token[] = [];
                    while(tokens[++i].type === "special"){
                        additionalContents.push(tokens[i]);
                    }
                    if (tokens[i].type === "bracket"){
                        if ((<BracketToken>tokens[i]).facing === "left"){
                            let contents = getBracketContents(i);
                            if (contents === undefined){
                                raiseError(new LangError(token, `No matching closing bracket`));
                                i = tokens.length;
                            }
                            else{
                                if ((<BracketToken>tokens[i]).shape === "curved"){
                                    discovered = new LangCode(context, _processStash([...additionalContents, ...contents]));
                                }
                                else{
                                    discovered = new LangCode(context, _processStash([...additionalContents, {...token, type: "block", value: [tokens[i], ...contents, tokens[i + contents.length + 1]]}]));
                                }
                                i += contents.length + 1;
                            }
                        }
                    }
                    else{
                        discovered = new LangCode(context, _processStash([...additionalContents, tokens[i]]));
                    }
                }
                else if (token.value === '#'){
                    if (nextCallMeta && nextCallMeta.type === 'hash'){
                        nextCallMeta.data += 1;
                    }
                    else{
                        if (nextCallMeta){
                            applyStack.push({callSite: token, func: LangFunction.IDENTITY, argList: [], meta: nextCallMeta});
                        }
                        nextCallMeta = {type: 'hash', data: 1};
                    }
                }
                else{
                    logBadToken(token);
                }
                break;
            case "keyword":
                if (token.value === "fun"){
                    let j = i;
                    while (tokens[++j].type === "name" || (tokens[j].type === "special" && tokens[j].value === '@')) {}
                    if (tokens[j].type === "special" && tokens[j].value === '='){
                        if (applyStack.length > 0 && applyStack.peek().argList.length === 0){
                            discovered = applyStack.pop()!.func;
                            dontTryCall = true;
                            i--;
                            break;
                        }
                        if (singleExpression){
                            logBadToken(token);
                        }
                        else{
                            let argTokens = tokens.slice(i+2, j);
                            if (argTokens.length === 0){
                                raiseError(new LangError(tokens[i+2], `Unexpected token '='. Functions must have at least one argument`));
                            }
                            applyStack.push({
                                callSite: token,
                                func: LangFunction.MKFUN,
                                argList: [new LangCode(context, processStash(argTokens))],
                                meta: {type: 'let', data: tokens[i+1]}
                            });
                            i = j;
                            discovered = undefined;
                        }
                    }
                    else{
                        discovered = LangFunction.MKFUN;
                    }
                }
                else{
                    if (singleExpression){
                        logBadToken(token);
                    }
                    if (i+2 < tokens.length){
                        if (tokens[i+1].type === "name"){
                            if (tokens[i+2].type === "special" && tokens[i+2].value === '='){
                                nextCallMeta = {type: 'let', data: tokens[i+1]};
                                i += 2;
                            }
                            else{
                                raiseError(new LangError(tokens[i+2], `Expected '=', instead found ${tokens[i+2].value}`));
                            }
                        }
                        else if (tokens[i+1].type === "special" && (<SpecialToken>tokens[i+1]).value === '#'){
                            let j = i + 1;
                            let hashDepth = 1;
                            while (tokens[++j].type === "special"){
                                switch((<SpecialToken>tokens[j]).value){
                                    case '#':
                                        hashDepth++;
                                        break;
                                    case '@':
                                        hashDepth--;
                                        break;
                                    case '=':
                                        logBadToken(tokens[j]);
                                        break;
                                }
                            }
                            if (hashDepth < 1){
                                raiseError(new LangError(tokens[i+1], `Expected name, but got something else`));
                            }
                            else{
                                if (tokens[j].type === "name"){
                                    let hashTokens = processHash(new LangCode(context, [tokens[j]]), hashDepth + 1, tokens[j]);
                                    tokens = [...tokens.slice(0, i+1), ...hashTokens, ...tokens.slice(j + 1)];
                                    i--;
                                }
                                else{
                                    raiseError(new LangError(tokens[j], `Expected name, instead found ${tokens[j].value}`));
                                }
                            }
                        }
                        else {
                            raiseError(new LangError(tokens[i+1], `Expected name, instead found ${tokens[i+1].value}`));
                        }
                    }
                    else{
                        logBadToken(token);
                    }
                }
                break;
        }
        handleDiscovered(token, discovered);
    }

    while (applyStack.length > 0 && applyStack.peek().argList.length === 0){
        i = tokens.length-1;
        lastOutputValue = handleDiscovered(tokens[tokens.length-1], applyStack.pop()!.func);
        if (applyStack.length === 1 && applyStack.peek().argList.length === 0){
            lastOutputValue = applyStack.pop()!.func;
            break;
        }
    }
    if (applyStack.length > 0){
        raiseError(new LangError(tokens[tokens.length-1], `Premature termination`));
    }
    if (!lastOutputValue){
        lastOutputValue = LangCode.EMPTY;
    }

    return lastOutputValue;
}