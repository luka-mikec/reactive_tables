<template>
  <div id="app" style="height: 100vh; width: max-content; display: flex; flex-direction: column; " >
    <div style="text-align: left; padding: 1ex;  ">
      <button @click="ui_add_rows">Add rows</button>
      <button @click="ui_add_cols">Add columns</button>
      <button @click="ui_get_tsv">Copy .tsv</button>
      <button @click="ui_load">Paste .tsv</button>
      Calculations: {{ calculations }}
      <br/>
      <div v-if="is_editing && false">
        Cell: <i>{{ raw_values[ui_editing_i][ui_editing_j] }}</i>
      </div>
    </div>

    <div style="overflow: auto; flex-grow: 1;">
      <table class="table" border="0">
        <tr class="row">
          <td id="empty_first_cell"></td>

          <td class="column column_not_number_label column_letter_label"
              v-for="(_, j) in ncols"
              :key="'header' + j"
              :id="'header' + j"
          >
            {{ column_names[j] }}
          </td>
        </tr>

        <tr class="row"
            v-for="(_, i) in nrows"
            :key="i"
            :id="'row' + i">
          <td class="column column_number_label">
            {{ i + 1 }}
          </td>

          <td class="column column_not_number_label column_content"
              v-for="(__, j) in ncols"
              :key="i + '-' + j"
              :ref="'input_container' + i + '-' + j"
              :id="'col' + i + '-' + j"
              :class="cell_classes(i, j)"
              style="position: relative;"
              @mousedown.self="cell_click(i, j, $event, true)"
              @mousedown.right="cell_rightclick(i, j, $event, true)"
              @mouseup="cell_released(i, j, $event)"
              @mousemove.self="cell_hover(i, j, $event)"
              @dblclick.self="cell_doubleclick(i, j, true)"
              tabindex="1"
              @keydown.self="ui_selected_key_press(i, j, $event)"
              @keydown.enter.prevent="ui_selected_cell_key_enter(i, j)"
              @keydown.left="ui_selected_cell_key_left(i, j, $event)"
              @keydown.right="ui_selected_cell_key_right(i, j, $event)"
              @keydown.tab.prevent="ui_selected_cell_key_right(i, j, $event)"
              @keydown.up="ui_selected_cell_key_up(i, j, $event)"
              @keydown.down="ui_selected_cell_key_down(i, j, $event)"
              @keydown.delete="ui_selected_cell_key_delete(i, j)"
              @keydown.esc="ui_selected_cell_key_esc(i, j)"
              i-paste="ui_paste(i, j, $event)"
              @focus="ui_focused(i, j)"
          >
            <div v-if="active(i, j)" style="width: 100%; display: flex; align-items: stretch; padding: 0;  ">
              <div
                  :ref="'input' + i + '-' + j"
                  :id="'input' + i + '-' + j"
                  style="width: 100%; padding: 2px; white-space: nowrap; "
                  contenteditable="true"
                  class="column__editable_region"
                  @input="ui_input(i, j)"
                  @keydown.enter.prevent.stop="ui_active_cell_key_enter()"
                  @keydown.left.stop="ui_active_cell_key_left($event)"
                  @keydown.right.stop="ui_active_cell_key_right($event)"
                  @keydown.tab.prevent.stop="ui_active_cell_key_right($event)"
                  @keydown.up.stop="ui_active_cell_key_up($event)"
                  @keydown.down.stop="ui_active_cell_key_down($event)"
                  @keydown.esc.stop="ui_active_cell_key_esc()"
                  i-paste.stop="ui_paste(i, j, $event)"
              />
              <div
                  style="border-left: 1px solid lightgrey; margin: 0; padding-left: 2px; padding-right: 2px; cursor: default;    "
                   @click="ui_cellmenu_shown = !ui_cellmenu_shown"
              >⋯</div>
              <div class="light_button_container" v-if="ui_cellmenu_shown">
                <div class="light_button light_button_vertical" @click.stop="spread_below(i, j)">
                  Spread below
                </div>
                <div class="light_button light_button_vertical" @click="spread_right(i, j)">
                  Spread right
                </div>
                <div class="light_button light_button_vertical" @click="spread(i, j, {})">
                  Spread
                </div>
              </div>
            </div>
            <div
                v-else
                @mousedown.self="cell_click(i, j, $event)"
                @dblclick.self="cell_doubleclick(i, j)"
                @mouseup="cell_released(i, j, $event)"
                v-html="computed_value_formatter(computed_values[i][j].value)"
                style="padding: 2px; white-space: nowrap;"
            />
          </td>
        </tr>
      </table>
    </div>
  </div>
</template>

<script>
import {ref, defineProps, reactive, computed, watchEffect, toRefs, nextTick, onUpdated} from "vue";
import * as spreadsheet from '/src/composables/spreadsheet'
import {column_names} from '/src/helpers/column_names'

export default {
  name: 'App',
  components: {},
  data() {
    return {
      column_names: column_names,
      ui_editing_i: null,
      ui_editing_j: null,
      ui_cellmenu_shown: false,

      /* selected cells, not including those spanned below */
      committed_selected_cells: new Set(),
      last_selected_cell: null,

      /* ongoing selection: modifiable by holding shift & clicking, or dragging the mouse */
      selected_block_span: null,
      mouse_not_released_since_cell: null,

      style_computations: 0,
    }
  },
  computed: {
    is_editing() {
      return ![null, undefined].includes(this.ui_editing_i);
    },
    is_multiselecting() {
      let selected = this.committed_selected_cells.size;
      if (selected > 1)
        return true;
      if (selected == 0)
        return false;
      // otherwise, one committed selected cell, do we have a span?
      // do we have a shift span?
      if (this.selected_block_span) {
        return this.last_selected_cell[0] != this.selected_block_span[0] ||
            this.last_selected_cell[1] != this.selected_block_span[1];
      }
      // no span and a single cell selected
      return false;
    },
    is_mouse_selecting() {
      return this.last_selected_cell &&
          this.mouse_not_released_since_cell &&
          this.last_selected_cell[0] == this.mouse_not_released_since_cell[0] &&
          this.last_selected_cell[1] == this.mouse_not_released_since_cell[1];
    },
    selection_tsv() {
      let bb_min_r = this.nrows, bb_max_r = -1, bb_min_c = this.ncols, bb_max_c = -1;
      // first run: just determine the bounding box
      for (let i = 0; i < this.nrows; ++i)
        for (let j = 0; j < this.ncols; ++j)
          if (this.is_selected(i, j))
            bb_min_r = Math.min(bb_min_r, i), bb_max_r = Math.max(bb_max_r, i), bb_min_c = Math.min(bb_min_c, j), bb_max_c = Math.max(bb_max_c, j);

      let str = '';
      for (let i = bb_min_r; i <= bb_max_r; ++i) {
        for (let j = bb_min_c; j <= bb_max_c; ++j) {
          str += this.is_selected(i, j) ? this.raw_values[i][j] : '';
          if (j != bb_max_c)
            str += '\t'
        }
        if (i != bb_max_r)
          str += '\n'
      }

      return str;
    },
  },
  methods: {
    test() {
      alert();
    },
    log(...args) {
      const d = new Date();
      console.log(d.getMinutes() + ":" + d.getSeconds(), ...args);
    },
    get_dom_input_container(i, j) {
      return this.$refs['input_container' + i + '-' + j];
    },
    get_dom_input(i, j) {
      return this.$refs['input' + i + '-' + j];
    },
    clear_selection() {
      this.log('clear_selection');

      // regularly selected cells
      this.committed_selected_cells.clear();

      // cells selected by holding down the shift key or dragging the mouse
      this.selected_block_span = null;
      this.mouse_not_released_since_cell = null;
    },
    select_single_cell(i, j) {
      this.log('select_single_cell', i, j);
      this.clear_selection();

      const cell_key = i + '-' + j;
      this.committed_selected_cells.add(cell_key);
      this.last_selected_cell = [i, j];
    },
    ui_focused(i, j) {
      this.log("ui_focused", i, j)

      if (this.last_selected_cell && this.last_selected_cell[0] == i && this.last_selected_cell[1] == j)
        return;

      if (this.selected_block_span && this.selected_block_span[0] == i && this.selected_block_span[1] == j)
        return;

      if (this.is_selected(i, j))
        return;

      this.select_single_cell(i, j);
    },
    activate(i, j, initial_content) {
      this.log('activate', i, j, initial_content);

      this.clear_selection();
      this.ui_editing_i = i;
      this.ui_editing_j = j;
      nextTick(() => {
        let el = this.get_dom_input(i, j);
        if (initial_content) {
          this.raw_values[i][j] = initial_content;
        }
        el.innerText = this.raw_values[i][j];
        el.focus();


        if (this.raw_values[i][j].length) {
          let range = document.createRange()
          let sel = window.getSelection()

          console.log(el, sel, this.raw_values[i][j].length)
          range.setStart(el.childNodes[0], this.raw_values[i][j].length)
          range.collapse(true)

          sel.removeAllRanges()
          sel.addRange(range)
        }

      });
    },
    commit_block_to_selection(block_origin, block_span) {
      if (!block_origin || !block_span)
        return;

      for (let ii = Math.min(block_origin[0], block_span[0]); ii <= Math.max(block_origin[0], block_span[0]); ++ii)
        for (let jj = Math.min(block_origin[1], block_span[1]); jj <= Math.max(block_origin[1], block_span[1]); ++jj) {
          this.committed_selected_cells.add(ii + '-' + jj);
        }
    },
    commit_selection_block() {
      this.log('commit_selection_block');

      this.commit_block_to_selection(this.last_selected_cell, this.selected_block_span);
      this.selected_block_span = null;
    },
    cell_rightclick(i, j, event, only_if_inactive) {
      this.log('cell_rightclick', i, j, event, only_if_inactive);


    },
    cell_click(i, j, event, only_if_inactive) {
      this.log('cell_click', i, j, event, only_if_inactive);


      if (only_if_inactive && this.active(i, j))
        return;

      if (!this.active(i, j))
        this.deactivate();

      const cell_key = i + '-' + j;
      if (event?.ctrlKey) {
        this.commit_selection_block();
        if (!this.is_selected(i, j)) {
          this.committed_selected_cells.add(cell_key);
          this.last_selected_cell = [i, j];
          // this is the first cell in a new drag
          this.mouse_not_released_since_cell = [i, j];
        } else {
          event.preventDefault(); // the click would immediately focus the cell; we wish to avoid this
          this.committed_selected_cells.delete(cell_key);
        }
      } else if (event?.shiftKey) {
        if (this.last_selected_cell) {
          this.selected_block_span = [i, j];
          // this is the first cell in a new drag
          this.mouse_not_released_since_cell = [i, j];
        } else {
          this.select_single_cell(i, j);
          // this is the first cell in a new drag
          this.mouse_not_released_since_cell = [i, j];
        }
      } else {
        this.select_single_cell(i, j);
        // this is the first cell in a new drag
        this.mouse_not_released_since_cell = [i, j];
      }
    },
    cell_doubleclick(i, j, only_if_inactive) {
      if (only_if_inactive && this.active(i, j))
        return;
      this.activate(i, j)
    },
    cell_released(i, j, event) {
      this.log('cell_released', i, j, event);

      this.mouse_not_released_since_cell = null;
    },
    cell_hover(i, j, event) {
      if (event.buttons != 1) {
        this.mouse_not_released_since_cell = null;

        return;
      }

      // if we are already selecting:
      //  - mouse not released must be set
      //  - mouse not released should not be different from the selection
      // todo?

      // optimise to avoid recomputing style
      if (this.selected_block_span && this.selected_block_span[0] == i && this.selected_block_span[1] == j)
        return;

      this.log('cell_hover', i, j, event, 'exactly button 1 down & span will change');

      if (this.is_mouse_selecting) // is dragging from cell legal?
        this.selected_block_span = [i, j];
    },
    is_selected_by_span(i, j) {
      const span = this.selected_block_span;
      return this.last_selected_cell && span &&
          Math.min(this.last_selected_cell[0], span[0]) <= i &&
          Math.max(this.last_selected_cell[0], span[0]) >= i &&
          Math.min(this.last_selected_cell[1], span[1]) <= j &&
          Math.max(this.last_selected_cell[1], span[1]) >= j;
    },
    is_selected(i, j) {
      return this.committed_selected_cells.has(i + '-' + j) || this.is_selected_by_span(i, j);
    },
    cell_classes(i, j) {
      /* no efficient way to do this reactively */
      if (!window.style_calculations)
        window.style_calculations = 0;
      ++window.style_calculations;

      const multi = this.is_multiselecting;
      return {
        column_active: this.active(i, j),
        column_inactive: !this.active(i, j),
        column_multiselected: this.is_selected(i, j) && multi,
        column_multiselected_last: this.last_selected_cell?.[0] == i && this.last_selected_cell?.[1] == j && multi,
        column_special_border_top:
            this.active(i, j) ||
            this.active(i - 1, j) ||
            (this.is_selected(i, j) && !this.is_selected(i - 1, j)) ||
            (this.is_selected(i - 1, j) && !this.is_selected(i, j)),
        column_special_border_bottom:
            this.active(i, j) ||
            this.active(i + 1, j) ||
            (this.is_selected(i, j) && !this.is_selected(i + 1, j)) ||
            (this.is_selected(i + 1, j) && !this.is_selected(i, j)),
        column_special_border_left:
            this.active(i, j) ||
            this.active(i, j - 1) ||
            (this.is_selected(i, j) && !this.is_selected(i, j - 1)) ||
            (this.is_selected(i, j - 1) && !this.is_selected(i, j)),
        column_special_border_right:
            this.active(i, j) ||
            this.active(i, j + 1) ||
            (this.is_selected(i, j) && !this.is_selected(i, j + 1)) ||
            (this.is_selected(i, j + 1) && !this.is_selected(i, j)),
      }
    },
    computed_value_formatter(str) {
      if (str === undefined || str === null)
        return 'none';
      return str;
    },
    deactivate() {
      this.log('deactivate');

      this.ui_editing_i = null;
      this.ui_editing_j = null;
    },
    async ui_selected_key_press(i, j, e) {
      this.log("ui_selected_key_press")

      if (e.ctrlKey && e.key) {
        // pasting is done in a special window.body paste handler
        if (e.key == 'c' || e.key == 'C') {
          this.ui_get_tsv();
        }
        if (e.key == 'x' || e.key == 'X') {
          this.ui_get_tsv();
          this.delete_selection();
        }
        if (e.key == 'a' || e.key == 'A') {
          console.log("sel a")
          this.last_selected_cell = [0, 0];
          this.selected_block_span = [this.nrows - 1, this.ncols - 1];
          e.preventDefault();
          e.stopPropagation();
        }
      }
      if (!e.ctrlKey && e.key && e.key.length == 1) {
        const code = e.key.charCodeAt(0);
        if (code >= 32 && code <= 127) {
          //this.activate(this.last_selected_cell[0], this.last_selected_cell[1], e.key);
          this.activate(this.last_selected_cell[0], this.last_selected_cell[1], '');
          //e.preventDefault();
          //e.stopPropagation();
        }
      }
    },
    ui_input(i, j) {
      this.log("ui input", i, j)

      this.raw_values[i][j] = this.get_dom_input(i, j).innerText.trim();
    },
    ui_active_cell_key_enter() {
      this.log("ui_active_cell_key_enter")

      this.ui_active_cell_key_down(event) || this.deactivate();
    },
    ui_active_cell_key_down(event) {
      this.log("ui_active_cell_key_down")

      if (this.ui_editing_i < this.nrows - 1) {
        event.preventDefault();
        event.stopPropagation();
        this.activate(this.ui_editing_i + 1, this.ui_editing_j);
        return true;
      }
      return false;
    },
    ui_active_cell_key_up(event) {
      this.log("ui_active_cell_key_up")

      if (this.ui_editing_i > 0) {
        event.preventDefault();
        event.stopPropagation();
        this.activate(this.ui_editing_i - 1, this.ui_editing_j);
      }
    },
    ui_active_cell_key_right(event) {
      this.log("ui_active_cell_key_right")

      let el = this.get_dom_input(this.ui_editing_i, this.ui_editing_j);
      let selection = window.getSelection();
      let sel_el = (selection.anchorNode == selection.focusNode) && selection.anchorNode;
      if (el == sel_el.parentElement && selection.anchorOffset != el.innerText.toString().length)
        return;

      if (this.ui_editing_j < this.ncols - 1) {
        event.preventDefault();
        event.stopPropagation();
        this.activate(this.ui_editing_i, this.ui_editing_j + 1);
      }
    },
    ui_active_cell_key_left(event) {
      this.log("ui_active_cell_key_left")

      let el = this.get_dom_input(this.ui_editing_i, this.ui_editing_j);
      let selection = window.getSelection();
      let sel_el = (selection.anchorNode == selection.focusNode) && selection.anchorNode;
      if (el == sel_el.parentElement && selection.anchorOffset > 0)
        return;

      if (this.ui_editing_j > 0) {
        this.activate(this.ui_editing_i, this.ui_editing_j - 1);
        event.preventDefault();
        event.stopPropagation();
      }
    },
    ui_active_cell_key_esc() {
      this.log("ui_active_cell_key_esc")

      const i = this.ui_editing_i, j = this.ui_editing_j;
      this.deactivate();
      this.select_single_cell(i, j);
      nextTick(() => {
        let el = this.get_dom_input_container(i, j);
        el.focus();
      });
    },
    ui_selected_cell_key_down(i, j, event) {
      this.log("ui_selected_cell_key_down", i, j)

      if (i < this.nrows - 1) {
        if (this.selected_block_span && event?.shiftKey) {
          if (this.selected_block_span?.[0] < this.nrows - 1)
            ++this.selected_block_span[0];
        } else if (event?.shiftKey) {
          this.selected_block_span = [i + 1, j];
        } else {
          this.select_single_cell(i + 1, j);
          this.$nextTick(() => this.get_dom_input_container(i + 1, j)?.focus());
        }
        return true;
      }
      return false;
    },
    ui_selected_cell_key_up(i, j, event) {
      this.log("ui_selected_cell_key_up", i, j)

      if (i > 0) {
        if (this.selected_block_span && event?.shiftKey) {
          if (this.selected_block_span?.[0] > 0)
            --this.selected_block_span[0];
        } else if (event?.shiftKey) {
          this.selected_block_span = [i - 1, j];
        } else {
          this.select_single_cell(i - 1, j);
          this.$nextTick(() => this.get_dom_input_container(i - 1, j)?.focus());
        }
      }
    },
    ui_selected_cell_key_right(i, j, event) {
      this.log("ui_selected_cell_key_right", i, j)

      if (j < this.ncols - 1) {
        if (this.selected_block_span && event?.shiftKey) {
          if (this.selected_block_span?.[1] < this.ncols - 1)
            ++this.selected_block_span[1];
        } else if (event?.shiftKey) {
          this.selected_block_span = [i, j + 1];
        } else {
          this.select_single_cell(i, j + 1);
          this.$nextTick(() => this.get_dom_input_container(i, j + 1)?.focus());
        }
        return true;
      }
      return false;
    },
    ui_selected_cell_key_left(i, j, event) {
      this.log("ui_selected_cell_key_left", i, j)

      if (j > 0) {
        if (this.selected_block_span && event?.shiftKey) {
          if (this.selected_block_span?.[1] > 0)
            --this.selected_block_span[1];
        } else if (event?.shiftKey) {
          this.selected_block_span = [i, j - 1];
        } else {
          this.select_single_cell(i, j - 1);
          this.$nextTick(() => this.get_dom_input_container(i, j - 1)?.focus());
        }
      }
    },
    delete_selection() {
      for (let i = 0; i < this.nrows; ++i)
        for (let j = 0; j < this.ncols; ++j)
          if (this.is_selected(i, j))
            this.raw_values[i][j] = '';
    },
    ui_selected_cell_key_delete(i, j) {
      this.log("ui_selected_cell_key_delete", i, j)

      this.delete_selection();
    },
    ui_selected_cell_key_esc(i, j) {
      this.log("ui_selected_cell_key_esc", i, j)

      this.select_single_cell(i, j);
    },
    ui_selected_cell_key_enter(i, j) {
      this.log("ui_selected_cell_key_enter", i, j)

      this.activate(i, j);
    },
    ui_add_rows() {
      this.change_dimensions(this.nrows + 5, undefined);
    },
    ui_add_cols() {
      this.change_dimensions(undefined, this.ncols + 5);
    },
    load_tsv(i, j, data) {
      const lines = data.split('\n');
      const cells = lines.map(line => line.split('\t'));

      this.clear_selection();
      const new_selection = [];
      for (let ii = i; ii < Math.min(this.nrows, i + lines.length); ++ii)
        for (let jj = j; jj < Math.min(this.ncols, j + cells[ii - i].length); ++jj) {
          this.raw_values[ii][jj] = cells[ii - i] && cells[ii - i][jj - j] || this.raw_values[ii][jj];
          const cell_key = ii + '-' + jj;
          new_selection.push(cell_key);
        }

      // did we just override content in the cell being edited?
      this.deactivate();
      // if (this.is_editing && cells[this.ui_editing_i - i] && cells[this.ui_editing_i - i][this.ui_editing_j - j]) {
          // if so, reload this content
      //  this.activate(this.ui_editing_i, this.ui_editing_j);
      // }

      // after activation
     // this.$nextTick(() => {
        console.log("setting selection");
        for (const val of new_selection)
          this.committed_selected_cells.add(val);
     // });
    },
    ui_paste(i, j, e) {
      this.log("ui_paste", i, j)

      const data = e.clipboardData && e.clipboardData.getData && e.clipboardData.getData('text/plain');
      if (data.includes("\n") || data.includes("\t")) {
        this.load_tsv(i, j, data);
        e.preventDefault();
      } else {
        // paste inside current cell
        if (!this.is_editing) {
          console.log("doing a thing");
          this.raw_values[this.last_selected_cell[0]][this.last_selected_cell[1]] = data;
        }
        else {
          return false;
        }
      }
      return true; // whether to prevent regular paste
    },
    async ui_load() {
      const queryOpts = {name: 'clipboard-read', allowWithoutGesture: false};
      const permissionStatus = await navigator.permissions.query(queryOpts);
// Will be 'granted', 'denied' or 'prompt':
      this.log(permissionStatus.state);
      if (permissionStatus.state == 'granted') {
        const data = await navigator.clipboard.readText();
        this.load_tsv(this.last_selected_cell?.[0] || 0, this.last_selected_cell?.[1] || 0, data);
      }

    },
    ui_get_tsv() {
      const tsv = this.selection_tsv;
      navigator.clipboard.writeText(tsv).then(function () {

      }, function (err) {
        alert("error :(")
      });

    },
    active(i, j) {
      return this.ui_editing_i === i && this.ui_editing_j === j;
    },
  },
  watch: {
    ui_editing_i(newValue, oldValue) {
      this.ui_cellmenu_shown = false;
    },
    ui_editing_j(newValue, oldValue) {
      this.ui_cellmenu_shown = false;
    },
    committed_selected_cells: {
      handler(newv, oldv) {
        console.log("set watch", newv, oldv);
      },
      deep: true
    }
  },
  setup() {
    window.ref = ref;
    window.reactive = reactive;
    window.computed = computed;

    spreadsheet.setup(20, 13);

    return {
      raw_values: spreadsheet.raw_values,
      computed_values: spreadsheet.computed_values,
      calculations: spreadsheet.calculations,
      nrows: spreadsheet.nrows,
      ncols: spreadsheet.ncols,
      change_dimensions: spreadsheet.change_dimensions,
      spread: spreadsheet.spread,
      spread_below: spreadsheet.spread_below,
      spread_right: spreadsheet.spread_right
    };
  },
  created() {
    window.app = this;
  },
  mounted() {
    /*
      https://bugs.chromium.org/p/chromium/issues/detail?id=506859
      this still happens, so we have to use a global listener...
    */
    window.document.body.addEventListener('paste', e => {
      if (!this.last_selected_cell)
        return;
      this.ui_paste(this.last_selected_cell[0], this.last_selected_cell[1], e)
    });
  }
}
</script>

<style lang="scss">

body, html {
  margin: 0;
  padding: 0;
}

#app {
  margin-top: 0;
  margin-left: auto;
  margin-right: auto;
}

.table {
  /*margin-left: auto;
  margin-right: auto;
  margin-top: 3ex;*/
  border-collapse: collapse;
  table-layout: fixed;
}

$regular_border: 1px lightgrey solid;

$special_border: 2px cornflowerblue solid !important;

.column {
  height: 24px;
  padding: 0px;
  box-sizing: border-box;
  background-clip: padding-box; /* otherwise firefox draws background above borders... */
  border-top: $regular_border;
  border-right: $regular_border;
  border-bottom: $regular_border;
  border-left: $regular_border;
  user-select: none; /* should be none, but chrome is buggy */
  /* border: 2px transparent solid; */
}

.column_not_number_label {
  min-width: 6em;
}

.column_letter_label {
  background: #f6f6f6;
  text-align: center !important;
}

.column_content {
  text-align: left;
}

.column_number_label {
  background: #f6f6f6;
  min-width: 3em;
  text-align: center;
}

#empty_first_cell {
  background: white;
}

.table {
  font-size: 10pt;
}

.column_active {
  border: $special_border;

  /* border: 2px cornflowerblue solid !important; */
  /* box-shadow: inset 0 0 0 1px cornflowerblue; */
  background-clip: content-box;
  /*outline: 1px cornflowerblue solid !important;*/
  /*padding: 0px;*/
}

.column_multiselected {
  background-color: #e7ecfd;
}

.column_multiselected_last {
  background-color: #c0cdfc !important;
  box-shadow: inset 0 0 0 1px #6495ed;
  background-clip: content-box;
}

.column_special_border_top {
  border-top: $special_border
}

.column_special_border_bottom {
  border-bottom: $special_border
}

.column_special_border_left {
  border-left: $special_border
}

.column_special_border_right {
  border-right: $special_border
}

.column_inactive {

}

.column__editable_region {
  outline: 0px solid transparent;
}

.column:focus {
  outline: 0px solid transparent;
}

button {
  background: none;
  box-shadow: none;
  border-radius: 3px;
  border: 1px solid darkslategray;
  color: darkslategray;
  background: #fafafa;
}

* + button  {
  margin-left: 0.5em;
}

.light_button {
  border: 1px solid darkgray;
  margin: 0;
  padding: 3px;
  cursor: default;
  z-index: 10;
}

.light_button_vertical {
  text-align: left;
}

.light_button_vertical + .light_button_vertical {
  border-top: 0px solid darkgray;
}

.light_button_container {
  position: absolute;
  right: -80px;
  bottom: -60px;
  display: flex;
  flex-direction: column;
  border-collapse: collapse;
  background: white;
  z-index: 5;
}

</style>