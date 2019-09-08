export class Stack<T> {
    private data: T[] = [];

    public get length(): number { return this.data.length }

    public peek(): T{
        return this.data[this.data.length-1];
    }
    public pop(): T | undefined{
        return this.data.pop();
    }
    public push(element: T){
        return this.data.push(element);
    }
}