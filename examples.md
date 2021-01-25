Fun with reactive functions...
```
=MAP('hello', name => 'hello ' + name + '!!!')			
=MAP("bla", (a, b)  => a + ', ' + b)			
=MAP('concat', (...list) => list.join('; '))			50
=MAP('give', n => Array(n).fill(0).map((i, j) => j))			=concat.value( ...give.value(D3))
```