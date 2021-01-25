export const column_names = [];
for (let i = 0; i <= 25; ++i)
    column_names.push(String.fromCharCode("A".charCodeAt(0) + i));

for (let i = 0; i <= 25; ++i)
    for (let j = 0; j <= 25; ++j)
        column_names.push(column_names[i] + column_names[j]);

for (let i = 0; i <= 25; ++i)
    for (let j = 0; j <= 25; ++j)
        for (let k = 0; k <= 25; ++k)
            column_names.push(column_names[i] + column_names[j] + column_names[k]);

