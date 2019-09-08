import Instance from "./instance.js";

const instance = new Instance();

// Write code in here.
instance.evalString(`
fun newFun @args @expr = (fun (#args) (#expr))
let identity = newFun x x
print identity @(Hello, World!)
print identity "Hello, World! (this time as a string)"

fun factorial n = (if <= n 1 1 (* n factorial - n 1))

fun factIter n = {
    let result = 1
    while (>= n 1) {
        result = * result n
        n = - n 1
        .
    }
    result
}

print factorial 5
print factIter 5

fun append list1 list2 = @(#list1 #list2)
fun push list @value = (append list value)

fun for @varname start @pred @inc @code = {
    let #varname = start
    while (#pred) {
        #code
        #varname = #inc
    }
}
fun loop @n @code = (for _ 0 (< _ #n) (+ _ 1) (#code))

loop 3 (print "abc")
for i 0 (< i 5) (+ i 1) (print i)

fun filter list @pred = {
    pred = eval pred
    let result = .
    let i = 0
    while (< i len list) {
        if pred at list i {
            result = append result at list i
            .
        } .
        i = + i 1
    }
    result
}

let l = @(1 2 3 4 5)
print filter l (fun x (> eval x 2))

fun sum a b = {
    let result = + a b
    fun next (if === next . result (sum result next))
}

print sum 1 2 3 4 .

print append @(Hello,) @(World!)
print push @(1 2 3) 4

`);