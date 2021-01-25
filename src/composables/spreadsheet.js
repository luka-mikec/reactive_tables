import {computed, nextTick, reactive, ref} from "vue";
import {column_names} from "/src/helpers/column_names";

export const nrows = ref(0);
export const ncols = ref(0);

export const make_table = (val = '', _nrows = nrows.value, _ncols = ncols.value) =>
    Array(_nrows).fill(null).map(() => Array(_ncols).fill(val));

// we will init the correct values later
export const raw_values = reactive([]);
export const computed_values = reactive([]);
export const calculations = ref(0);

export const transpile = str => {
    let cell_name_replacer = (match, __prepend__, col, row, second_match, second_col, second_row) => {
        col = column_names.indexOf(col);
        row = Number.parseInt(row) - 1;

        if (second_match) {
            second_col = column_names.indexOf(second_col);
            second_row = Number.parseInt(second_row) - 1;
            return __prepend__ + `${row},${col},${second_row},${second_col}`;
        }

        return __prepend__ + `computed_values[${row}][${col}].value`;
    };
    str = str.replace(/(^|[^A-Z])[$]?([A-Z]{1,2})[$]?([0-9]+)(:[$]?([A-Z]{1,2})[$]?([0-9]+))?/g, cell_name_replacer);

    let math_fn_replacer = (match) => {
        return 'Math.' + match.toLocaleLowerCase();
    };
    str = str.replace(/SIN|COS|SQRT|ABS|FLOOR|CEIL|LOG2|LOG10|LOG/g, math_fn_replacer);

    return str;
};

export const function_cache = reactive({});

export const as_number = raw_cell => /^[0-9]+(\.[0-9]+)?$/.test(raw_cell)  ?  Number.parseFloat(raw_cell) : raw_cell;

export const computed_cell_generator = (i, j) => {
    const computed_cell = computed(() => {

        // wrap this in async so that computed_cell doesn't get called again
        nextTick(() => ++calculations.value);

        let raw_cell = raw_values[i][j].toString().trim();
        if (!raw_cell || raw_cell[0] != '=') {
            return as_number(raw_cell);
        }

        let user_code = raw_cell.substring(1);
        let code;
        let fn;

        // did we already compile this code?
        if (function_cache[user_code]) {
            fn = function_cache[user_code];
        }
        // we did not: try compiling if valid syntax
        else {
            code = transpile(user_code);
            try {
                fn = new Function(['computed_values'], 'let res; res = ' + code + '; return res;');
            }
                // not compiled and invalid syntax
            catch (e) {
                console.log(user_code, code, e);
                fn = computed_values => "ERROR " + String.fromCodePoint(0x1F4A3);
            }
        }

        try {
            return fn(computed_values);
        } catch (e) {
            console.log(user_code, fn, e);
            return "ERROR " + String.fromCodePoint(0x1F494);
        }

    });
    return computed_cell;
};

export const change_dimensions = (new_nrows, new_ncols) => {
    new_nrows = new_nrows || nrows.value;
    new_ncols = new_ncols || ncols.value;

    if (new_nrows < nrows.value) {
        raw_values.splice(nrows.value);
        computed_values.splice(nrows.value);
    }
    if (new_nrows > nrows.value) {
        const new_rows = make_table('', new_nrows - nrows.value, 0);
        const new_rows2 = make_table('', new_nrows - nrows.value, 0);
        raw_values.push(...new_rows);
        computed_values.push(...new_rows2);
    }
    if (nrows.value != new_nrows || ncols.value != new_ncols) {
        for (let i = 0; i < new_nrows; ++i) {
            let raw_row = raw_values[i];
            let computed_row = computed_values[i];
            const old_ncols = raw_row.length;
            if (new_ncols > old_ncols) {
                const new_cols = Array(new_ncols - old_ncols).fill('');
                raw_row.push(...new_cols);
                for (let j = old_ncols; j < new_ncols; ++j) {
                    computed_row[j] = computed_cell_generator(i, j);
                }
            } else {
                raw_row.splice(new_ncols);
                computed_row.splice(new_ncols);
            }
        }
    }
    nrows.value = new_nrows;
    ncols.value = new_ncols;
};

const empty = val => val === null || val === undefined || val === '';

export const spread = (i, j, { start_i, start_j, end_i, end_j }) => {
    // what type of cell is (i, j)?
    let is_computed = raw_values[i][j] && raw_values[i][j].toString().trim()[0] == '=';

    // if it is not computed, is it a number?
    let num = as_number(raw_values[i][j]);

    // where do we start?
    if (start_i === undefined)
        start_i = i;
    if (start_j === undefined)
        start_j = j;

    // how for can we go?
    if (end_i === undefined) {
        end_i = i;
        for (end_i = start_i; end_i == i || end_i < nrows.value && empty(raw_values[end_i][j]); ++end_i);
    }

    if (end_j === undefined) {
        end_j = j;
        end_j_search:
            for (end_j = start_j; end_j < ncols.value; ++end_j) {
                for (let ii = start_i; ii < end_i; ++ii)
                    if (!(end_j == j && ii == i) && !empty(raw_values[ii][end_j]))
                        break end_j_search;
            }
    }

    // replace every cell from the current to the final cell
    for (let ii = start_i; ii < end_i; ++ii)
        for (let jj = start_j; jj < end_j; ++jj) {
            if (ii == i && jj == j)
                continue;

            if (is_computed) {
                let cell_name_replacer = (match, __prepend__, col_fixed, col, row_fixed, row) => {
                    col = column_names.indexOf(col);
                    row = Number.parseInt(row) - 1;

                    const new_col = col_fixed ? col : col + (jj - j);
                    const new_row = row_fixed ? row : row + (ii - i);

                    return __prepend__ + col_fixed + column_names[new_col] + row_fixed + (new_row + 1); // letters[new_row];
                };
                raw_values[ii][jj] = raw_values[i][j].replace(/(^|[^A-Z])([$]?)([A-Z]{1,2})([$]?)([0-9]+)/g, cell_name_replacer);
            }
            else {
                let did_spread = false;
                // possibly an arithmetical sequence
                if (typeof num == 'number') {
                    // spreading to the right:
                    let raw_to_up = i > 0 && raw_values[i - 1][j];
                    let raw_to_left = j > 0 && raw_values[i][j - 1];
                    let num_to_up = as_number(raw_to_up);
                    let num_to_left = as_number(raw_to_left);
                    if (end_i - start_i == 1 && typeof num_to_left == 'number') {
                        let d = num - num_to_left;
                        raw_values[ii][jj] = num + d * (jj - j);
                        did_spread = true;
                    }
                    else if (end_j - start_j == 1 && typeof num_to_up == 'number') {
                        let d = num - num_to_up;
                        raw_values[ii][jj] = num + d * (ii - i);
                        did_spread = true;
                    }
                }
                if (!did_spread) {
                    raw_values[ii][jj] = raw_values[i][j];
                    did_spread = true;
                }
            }
        }
}

export const setup = (nrows, ncols) => {
    change_dimensions(nrows, ncols);

    window.SUM = (row, col, s_row, s_col) => {
        let sum = 0;
        for (let i = row; i <= s_row; ++i)
            for (let j = col; j <= s_col; ++j)
                sum += computed_values[i][j].value;
        return sum;
    }

    window.COUNT = (row, col, s_row, s_col) => {
        let sum = 0;
        for (let i = row; i <= s_row; ++i)
            for (let j = col; j <= s_col; ++j)
                sum += !['', null, undefined].includes(computed_values[i][j].value);
        return sum;
    }

    window.IF = (condition, if_true, if_false) => condition ? if_true : if_false;

    window.MAP = (name, func) => {
        if (!window[name])
            window[name.toString()] = ref(null);
        window[name].value = func;
        return `[map ${name}]`
    }

    window.CALL = (name, ...args) => {
        if (!window[name])
            throw 1;
        return window[name].value(...args);
    }
}

export const spread_below = (i, j) => spread(i, j, {end_j: j + 1});

export const spread_right = (i, j) => spread(i, j, { start_j: j + 1, start_i: i, end_i: i + 1  });
