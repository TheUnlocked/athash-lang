export interface TokenBase {
    type: string;
    line: number;
    col: number;
}
export interface SpecialToken extends TokenBase {
    type: "special";
    value: '=' | '#' | '@';
}
export interface KeywordToken extends TokenBase {
    type: "keyword";
    value: "fun" | "let";
}
export interface NameToken extends TokenBase {
    type: "name";
    value: string;
}
export interface NumberToken extends TokenBase {
    type: "number";
    value: number;
}
export interface BracketToken extends TokenBase {
    type: "bracket";
    facing: "left" | "right";
    shape: "curved" | "curly";
    value: string;
}
export interface StringToken extends TokenBase {
    type: "string";
    value: string;
}
export type Token = SpecialToken | KeywordToken | NameToken | BracketToken | StringToken | NumberToken;
export const isToken = (obj: any): obj is Token => {
    return obj.type && obj.col && obj.line && (
        obj.type === "special" ||
        obj.type === "keyword" ||
        obj.type === "name" ||
        obj.type === "bracket" ||
        obj.type === "string" ||
        obj.type === "number"
    );
}

const wsRegex : RegExp = /\s/;
const brackets : {[char: string]: {facing: "left" | "right", shape: "curved" | "curly"}} = {
    '(': {facing: "left", shape: "curved"},
    ')': {facing: "right", shape: "curved"},
    '{': {facing: "left", shape: "curly"},
    '}': {facing: "right", shape: "curly"},
}
const bracketChars: string[] = ['(', ')', '{', '}']
const specialChars: string[] = ['=', '#', '@']

export const lex = (code: string): Token[] => {
    let tokens: Token[] = [];

    let line: number = 0;
    let col: number = 0;

    let buf: string = "";
    const clearBuffer = () => {
        if (buf !== ''){
            let numberForm = Number(buf);
            if (isNaN(numberForm)){
                tokens.push({ type: "name", value: buf, col: col - buf.length, line: line });
            }
            else{
                tokens.push({ type: "number", value: numberForm, col: col - buf.length, line: line })
            }
            buf = '';
        }
    };

    for (let i = 0; i < code.length; i++){
        if (code[i] === '/' && i+1 < code.length && code[i+1] === '/'){
            clearBuffer();
            while (++i < code.length && code[i] !== '\n'){}
            col = 0;
            line++;
        }
        else if (code[i] === '"'){
            let startCol = col;
            let startLine = line;
            let start = i+1;
            let lastLineStart = i;
            while (true){
                if (++i >= code.length){
                    break;
                }
                else if (code[i] === '\\'){
                    if (++i >= code.length){
                        break;
                    }
                }
                else if (code[i] === '\n'){
                    line++;
                    lastLineStart = i + 1;
                }
                else if (code[i] === '"'){
                    break;
                }
            }
            col = i - lastLineStart;
            let processedString = code.slice(start, i);
            let index = processedString.indexOf('\\');
            while (index !== -1){
                index += 1;
                let nextIndex = index;
                let replacementString = '';
                if (['b', 'f', 'n', 'r', 't', 'v', '0', '"', '\\'].includes(processedString[index])){
                    replacementString = JSON.parse(`"\\${processedString[index]}"`);
                    nextIndex++;
                }
                else if (processedString[index] === 'u'){
                    replacementString = JSON.parse(`"\\${processedString.slice(index, index+5)}"`);
                    nextIndex += 5;
                }
                processedString = processedString.slice(0, index - 1) + replacementString + processedString.slice(nextIndex);
                index = processedString.indexOf('\\', index);
            }
            tokens.push({ type: "string", value: processedString, line: startLine, col: startCol });
        }
        else if (wsRegex.test(code[i])){
            clearBuffer();
            if (code[i] === '\n'){
                col = 0;
                line++;
            }
            else {
                col++;
            }
        }
        else if (bracketChars.includes(code[i])){
            clearBuffer();
            tokens.push({
                type: "bracket",
                ...brackets[code[i]],
                value: code[i],
                line: line,
                col: col
            });
            col++;
        }
        else if (specialChars.includes(code[i])){
            if (code[i] === '=' && !(buf === '' && i+1 < code.length && (wsRegex.test(code[i+1]) || bracketChars.includes(code[i+1])))){
                buf += code[i];
                col++;
            }
            else{
                clearBuffer();
                tokens.push({ type: "special", value: <'=' | '#' | '@'>code[i], col: col, line: line });
                col++;
            }
            
        }
        else{
            let kwCheck = false;
            if (buf === "" && code.length > i + 2){
                if (code[i] === 'f' && code[i+1] === 'u' && code[i+2] === 'n'){
                    buf = 'fun';
                    i += 2;
                    col += 3;
                    kwCheck = true;
                }
                if (code[i] === 'l' && code[i+1] === 'e' && code[i+2] === 't'){
                    buf = 'let';
                    i += 2;
                    col += 3;
                    kwCheck = true;
                }
            }
            if (kwCheck){
                if (i < code.length && (wsRegex.test(code[i+1]) || bracketChars.includes(code[i+1]))){
                    tokens.push({ type: "keyword", value: <"fun" | "let">buf, col: col-3, line: line });
                    buf = '';
                    continue;
                }
            }
            buf += code[i];
            col++;
        }
    }
    clearBuffer();

    return tokens;
}