
/**
 * 一款基于jQuery的轻量级可编辑表格插件，适用于快速录单等应用场景，支持键盘操作
 * 
 * @package  funsent
 * @link     http://www.funsent.com/
 * @license  https://opensource.org/licenses/MIT/
 * @author   yanggf <2018708@qq.com>
 * @version  v0.2.3
 */

 ; (function (global, factory) {
    "use strict";
    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = global.document ? factory(global, true) : function (w) {
            if (!w.document) {
                throw new Error('jQuery requires a window with a document');
            }
            return factory(w);
        };
    } else {
        factory(global);
    }
})(typeof window !== 'undefined' ? window : this, function (window, noGlobal) {

    let $ = jQuery;

    // 默认参数
    let defaults = {
        // etable实例唯一标签，用于获取数据时识别特定etable实例
        tag: '',
        // 空表格时为可编辑行数，非空表格时为多出的可编辑行数
        row_number: 0,
        // 空表格时为可编辑列数
        column_number: 0,
        // 可编辑行数的上限
        editable_row_max: 10,
        // 启用键盘操作
        enable_keyboard: false,
        // 焦点在最后一个元素上时按TAB键插入新行，enable_keyboard为true时有效
        enable_tab_insert: false,
        // 启用操作按钮
        enable_button: false,
        // 不启用编辑的行索引, 如果为数字，表示前几行都不启用编辑
        no_edit_rows: [],
        // 自定义列数组
        columns: [
            // 复选框类型，此时width、height、align等字段无效，且永远水平居中    
            // {type:'checkbox', name:'', value:'', width:'100%', height:'100%', align:'', readonly:false},
            // 文本类型，默认的类型
            // {type:'text', name:'', value:'', width:'100%', height:'100%', align:'', readonly:false},
            // select多出一个下拉数据源的字段values，且必须为数组形式给出
            // {type:'select', name:'', value:'', width:'100%', height:'100%', align:'', readonly:false, values:[]},
            // 日期类型，一种点击弹出日期选择框的文本类型
            // {type:'date', name:'', value:'', width:'100%', height:'100%', align:'', readonly:true},
            // 整数类型，positive字段确定是否只能为正数，negtive字段确定是否只能为负数，zero字段确定是否包含0。待实现
            // {type:'integer', positive:true, negtive:false, zero:true, name:'', value:'', width:'100%', height:'100%', align:'', readonly:false},
            // 数字类型，positive字段确定是否只能为正数，negtive字段确定是否只能为负数，zero字段确定是否允许包含0。待实现
            // {type:'number', positive:true, negtive:false, zero:true, name:'', value:'', width:'100%', height:'100%', align:'', readonly:false},
        ],
    };

    // 编辑元素
    const editableInputs = 'input,select,textarea';

    // 语言包
    const langs = {
        'invalid element name': '{0} 参数必须是有效的table样式字符串或者table的DOM对象',
        'instance not found': 'etable 实例不存在',
        'create etable on hidden element is invalid': '隐藏元素上创建etable是无意义的',
        'the immediate parent of table must be a block element': 'table的直接父级元素必须是块元素（display:block）',
        'cannot insert more rows': '无法新增行，最多编辑行数：{0}',
        'the last row cannot be deleted': '禁止删除唯一行'
    };

    // 返回类型
    const getType = function (v) {
        return Object.prototype.toString.call(v).toLowerCase();
    };

    // 私有方法
    const _this = {

        /**
         * 实例集合，每行代表一个table实例，支持在一个页面下设置多个etable
         * 参数说明：
         * 1. element 每个实例的原始table元素
         * 2. element_key 每个实例键名
         * 3. target 每个实例的jQuery对象
         * 4. tag 每个实例的唯一标签
         * 5. configs 每个实例配置参数
         * 6. existable_rows 原始行
         * 7. editable_rows 可编辑行
         */
        instances: [
            // { element: null, element_key: '', 'target': null, tag: '', 'configs': {}, 'existable_rows': [], 'editable_rows': [] },
            // { element: null, element_key: '', 'target': null, tag: '', 'configs': {}, 'existable_rows': [], 'editable_rows': [] },
            // { element: null, element_key: '', 'target': null, tag: '', 'configs': {}, 'existable_rows': [], 'editable_rows': [] },
        ],

        // 获取实例
        // element参数可以为：
        // 1. table的DOM对象
        // 2. table样式字符串
        // 3. 自定义table的tag唯一字符串标签，必须以json对象形式给出，如：{tag:'table'}
        // 4. 整数索引，实例化etable的顺序
        instance: function (element) {

            if (this.isNumber(element)) {
                // 根据实例化顺序索引获取对应实例
                if (element < 0) {
                    return undefined;
                }
                let index = Math.floor(element);
                let instance = this.instances[index];
                if (!instance) {
                    this.consoleError(this.lang('instance not found'));
                    return undefined;
                }
                return instance;
            }

            if (this.isJsonObject(element)) {
                // 根据标签获取对应实例
                let tag = element['tag'];
                if (tag) {
                    for (let key in this.instances) {
                        let instance = this.instances[key];
                        if (instance.tag === tag) {
                            return instance;
                        }
                    }
                    element = element['element'];
                }
            }

            if (!this.isString(element) && !this.isTableElement(element) && !(element instanceof $)) {
                this.consoleError(this.lang('invalid element name', 'element'));
                return undefined;
            }

            for (let key in this.instances) {
                let instance = this.instances[key];
                if (instance.element === element) {
                    return instance;
                }
            }

            this.consoleError(this.lang('instance not found'));
            return undefined;
        },

        // 序列化表格数据，返回json对象数组的表单数据
        data: function (element) {
            let instance = this.instance(element);
            if (!instance) {
                return null;
            }

            let rows = instance.editable_rows;
            if (!rows.length) {
                return null;
            }

            let arr = [];
            for (let key in rows) {
                let $columns = rows[key].find('td');
                let inputs = {};
                $columns.each(function () {
                    // let $inputs = $(this).children(editableInputs);
                    let $inputs = $(this).find(editableInputs);
                    if ($inputs.length) {
                        let $input = $inputs.eq(0),
                            name = $input.prop('name'),
                            value = $input.val(),
                            tagName = $input.prop('tagName').toLowerCase(),
                            type = $input.prop('type').toLowerCase();
                        if (tagName == 'input' && type == 'checkbox') {
                            if (!$inputs.prop('checked')) {
                                value = '';
                            }
                        }
                        inputs[name] = value;
                    }
                });
                arr.push(inputs);
            }
            return arr;
        },

        // 回填数据
        fill: function (element, records) {
            if (!this.isArray(records) || records.length == 0) {
                return false;
            }

            let instance = this.instance(element);
            if (!instance) {
                return false;
            }

            let rows = instance.editable_rows;
            if (!rows.length) {
                return false;
            }

            let i = 0;
            for (let key in rows) {
                let record = records.splice(0, 1);
                if (!record.length) {
                    break;
                }
                record = record[0]; // 此处注意，splice 返回的是一个数组类型

                rows[key].find('td').each(function () {
                    let $inputs = $(this).find(editableInputs);
                    if ($inputs.length) {

                        let $input = $inputs.eq(0),
                            name = $input.prop('name'),
                            tagName = $input.prop('tagName').toLowerCase(),
                            type = $input.prop('type').toLowerCase();
                        let value = record[name] || '';
                        if (tagName == 'select' || tagName == 'textarea') {
                            $input.val(value);
                            return;
                        }
                        if (tagName == 'input') {
                            if (type == 'checkbox') {
                                $input.prop('checked', $input.val() == value);
                                return;
                            }
                            $input.val(value);
                        }
                    }
                });
                i++;
            }
            return true;
        },

        // 创建实例
        // element参数可以为：
        // 1. table样式字符串
        // 2. table的DOM对象
        // 3. table的jQuery对象
        create: function (element, opts) {
            let $target, msg = this.lang('invalid element name', 'element');
            if (this.isString(element)) {
                $target = $(element).eq(0);
                if (!$target.is('table')) {
                    this.consoleError(msg);
                    return false;
                }
            } else if (this.isTableElement(element)) {
                $target = $(element).eq(0);
            } else if (element instanceof $) {
                $target = element.eq(0);
                if (!$target.is('table')) {
                    this.consoleError(msg);
                    return false;
                }
            } else {
                this.consoleError(msg);
                return false;
            }


            if ($target.is(':hidden')) {
                this.consoleError(this.lang('create etable on hidden element is invalid'));
                return false;
            }

            if ($target.parent().css('display') != 'block') {
                this.consoleError(this.lang('the immediate parent of table must be a block element'));
                return false;
            }

            if (!this.isJsonObject(opts)) {
                opts = {};
            }

            let tag = opts['tag'];
            if (!this.isString(tag)) {
                opts['tag'] = tag = '';
            }

            // 清理原先相同属性的实例
            for (let i = 0; i < this.instances.length; i++) {
                let oldInstance = this.instances[i];
                if (oldInstance.element === element || oldInstance.target === $target) {
                    this.instances.splice(i--, 1); // 注意下标变化
                } else if (tag.length && oldInstance.tag === tag) {
                    this.instances.splice(i--, 1); // 注意下标变化
                }
            }

            let configs = Object.assign({}, defaults, opts);

            let instance = {
                element: element,
                // element_key: elementKey,
                target: $target,
                tag: tag,
                configs: configs,
                existable_rows: [],
                editable_rows: []
            };

            this.instances.push(instance);

            // 添加element_key
            let elementKeyPrefix = 'funsent_etable';
            for (let i = 0, length = this.instances.length; i < length; i++) {
                this.instances[i].element_key = elementKeyPrefix + i;
            }

            return instance;
        },

        //TODO 还原，使得已经etable编辑状态的变成原始的td状态
        restore: function () { },

        //TODO 预览，使得编辑好的数据直接呈现在td中，并关停etable编辑状态
        // 应用场景：如提交后不需要在启用etable编辑的情况，可调用此方法
        preview: function () { },

        //TODO 移动行，向上向下移动（交换行）
        move: function () { },

        // 获取实例信息，供调试输出使用
        info: function (element, key) {
            let instance = this.instance(element);
            if (!instance) {
                return this.instances;
            }
            if (!this.isString(key)) {
                return instance;
            }
            return instance[key] || undefined;
        },

        // 渲染
        render: function (instance) {
            let $table = instance.target,
                $thead = $table.find('thead').eq(0),
                $tbody = $table.find('tbody').eq(0),
                $trs = $tbody.find('tr');

            let trCnt = $trs.length, tdCnt = $thead.find('tr > th').length;
            let textAligns = [];

            // 转换原始行
            let noEditRows = instance.configs['no_edit_rows'];
            if (trCnt > 0 && tdCnt > 0) {
                for (let i = 0; i < trCnt; i++) {

                    let $tr = $trs.eq(i);
                    instance.existable_rows.push($tr);

                    // 不转换的行
                    if (this.isArray(noEditRows)) {
                        if (this.inArray(i, noEditRows)) {
                            continue;
                        }
                    } else if (this.isNumber(noEditRows)) {
                        if (i < Math.ceil(noEditRows)) {
                            continue;
                        }
                    }

                    let $tds = $tr.find('td');
                    for (let j = 0; j < tdCnt; j++) {
                        let $td = $tds.eq(j), textValue = $td.text(), textAlign = $td.css('textAlign');
                        let $editor = this.createEditor(instance, 'change', i, j, textValue, textAlign);
                        $td.html($editor).css({ padding: 0, textAlign: textAlign });

                        // 临时保存td原有的对齐方式
                        textAligns[j] = textAlign;
                    }

                    instance.editable_rows.push($tr);
                }
            }

            // 处理新加行
            if (trCnt = instance.configs['row_number']) {
                if (tdCnt == 0) {
                    tdCnt = instance.configs['column_number'];
                }
                let columns = instance.configs['columns'];
                for (let i = 0; i < trCnt; i++) {
                    let $tr = $('<tr></tr>');
                    for (let j = 0; j < tdCnt; j++) {
                        let column = columns[j] || {}, columnAlign = column['align'] || '';
                        let $td = $('<td></td>'), textValue = '', textAlign = textAligns[j] || columnAlign;
                        let $editor = this.createEditor(instance, 'attach', i, j, textValue, textAlign);
                        $td.html($editor).css({ padding: 0, textAlign: textAlign });
                        $tr.append($td);
                    }
                    $tbody.append($tr);

                    // 保存行
                    instance.editable_rows.push($tr);
                }
            }
        },

        // 设置键盘操作
        setKeyboard: function (instance) {
            if (!instance.configs['enable_keyboard']) {
                return;
            }

            let rows = instance.editable_rows, rowCnt = rows.length;
            if (!rowCnt) {
                return;
            }

            // 所有编辑元素个数、每行可编辑元素的列数
            let inputs = [], inputCnt = 0;
            for (let key in rows) {
                let row = rows[key];
                let $columns = row.find('td');
                $columns.each(function () {
                    let $inputs = $(this).children(editableInputs);
                    if ($inputs.length) {
                        inputs.push($inputs.eq(0));
                        inputCnt++;
                    }
                });
            }
            let editableColumnCnt = inputCnt / rowCnt;

            let that = this;
            for (let i = 0; i < inputCnt; i++) {
                let $input = inputs[i], index = i;
                $input.unbind('keydown').bind('keydown', function (e) {
                    let k = e.keyCode;

                    if (k == 32) {
                        // 空格键按下时，如果碰到日期选择框，则触发click事件，以便能够弹出日期选择框
                        if ($input.hasClass('funsent-etable-input-date')) {
                            $input.trigger('click');
                        }
                        return;
                    }

                    if (k == 9 || k == 39 || k == 13) {
                        // 焦点在最后一个元素上时按TAB键插入新行，enable_keyboard为true时有效
                        if (k == 9 && instance.configs['enable_tab_insert'] && index == inputCnt - 1) {
                            let rowIndex = rowCnt - 1;
                            if (that.insertEditableRow(instance, rowIndex, 'after')) {
                                that.setToolBtns(instance);
                                that.resetOrder(instance);
                                that.setKeyboard(instance);
                            }
                            return;
                        }
                        // TAB键、右方向键和回车键
                        if (index < inputCnt - 1) {
                            let tmpIndex = index + 1, $input = inputs[tmpIndex];
                            $input.focus();
                            if ($input.prop('tagName').toLowerCase() != 'select') {
                                $input.select();
                            }
                        }
                        // 修复问题：1.防止TAB键时跳2次；2.防止右方向键改变select的值
                        (k == 9 || k == 39) && e.preventDefault();
                    } else if (k == 37) {
                        // 左方向键
                        if (index >= 1) {
                            let tmpIndex = index - 1, $input = inputs[tmpIndex];
                            $input.focus();
                            if ($input.prop('tagName').toLowerCase() != 'select') {
                                $input.select();
                            }
                        }
                        // 修复问题：1.防止左方向键改变select的值 
                        e.preventDefault();
                    } else if (k == 38) {
                        // 上方向键
                        // 计算上一行同一个位置的索引
                        let tmpIndex = index - editableColumnCnt;
                        if (tmpIndex >= 0) {
                            let $input = inputs[tmpIndex];
                            $input.focus();
                            if ($input.prop('tagName').toLowerCase() != 'select') {
                                $input.select();
                            }
                        }
                        // 修复问题：1.防止上方向键改变select的值
                        e.preventDefault();
                    } else if (k == 40) {
                        // 下方向键
                        // 计算下一行同一个位置的索引
                        let tmpIndex = index + editableColumnCnt;
                        if (tmpIndex <= inputCnt - 1) {
                            let $input = inputs[tmpIndex];
                            $input.focus();
                            if ($input.prop('tagName').toLowerCase() != 'select') {
                                $input.select();
                            }
                        }
                        // 修复问题：1.防止下方向键改变select的值
                        e.preventDefault();
                    }
                });
            }
        },

        // 设置工具按钮
        setToolBtns: function (instance) {
            let rows = instance.editable_rows, rowCnt = rows.length;
            if (!instance.configs['enable_button'] || !rowCnt) {
                return;
            }

            let $table = instance.target, $thead = $table.find('thead'), theadHeight = $thead.outerHeight(); let $parent = $table.parent().css('position', 'relative');

            // 删除之前的所有工具按钮
            $parent.find('div.funsent-etable-btn-group').remove();

            let btnGroupStyle = { position: 'absolute', left: '2px', top: '0', display: 'block', padding: '0', margin: '0', width: '48px', height: '14px', overflow: 'hidden', backgroundColor: 'transparent' };
            let btnStyle = { opacity: '0.3', fontSize: '12px', width: '12px', height: '12px', lineHeight: '12px', display: 'block', float: 'left', textAlign: 'center', backgroundColor: '#eff8fd', color: '#06f', padding: '0', margin: '0 2px 0 0', border: '1px solid #06f', borderRadius: '2px', position: 'relative' };
            let btnLabelStyle = { position: 'absolute', left: '0', display: 'block', width: '12px', height: '100%', lineHeight: '100%', cursor: 'pointer' };
            const over = function () { $(this).css({ opacity: '1', backgroundColor: '#06f', color: '#eff8fd' }); };
            const out = function () { $(this).css({ opacity: '0.3', backgroundColor: '#eff8fd', color: '#06f' }); };
            const down = function () { $(this).css({ positon: 'relative', left: '1px', top: '1px' }); };
            const up = function () { $(this).css({ positon: 'static', left: '0', top: '0' }); }

            let that = this;
            for (let i = 0; i < rowCnt; i++) {

                let $btn1 = $('<a class="funsent-etable-btn" href="javascript:;" title="上方插入新行"><label>&#9650</label></a>').css(btnStyle).hover(over, out).mousedown(down).mouseup(up).find('label').css(btnLabelStyle).end(),
                    $btn2 = $('<a class="funsent-etable-btn" href="javascript:;" title="下方插入新行"><label>&#9660</label></a>').css(btnStyle).hover(over, out).mousedown(down).mouseup(up).find('label').css(btnLabelStyle).end(),
                    $btn3 = $('<a class="funsent-etable-btn" href="javascript:;" title="删除当前行"><label>&#9986</label></a>').css(btnStyle).hover(over, out).mousedown(down).mouseup(up).find('label').css(btnLabelStyle).end();

                let $row = rows[i], top = theadHeight + ($row.outerHeight() * i) + 2;
                let $group = $('<div class="funsent-etable-btn-group"></div>').css(btnGroupStyle);
                $group.append($btn1, $btn2, $btn3).css('top', top);

                // 上方插入新行
                $btn1.bind('click', function () {
                    if (that.insertEditableRow(instance, i, 'before')) {
                        that.setToolBtns(instance);
                        that.resetOrder(instance);
                        that.setKeyboard(instance);
                    }
                });
                // 下方插入新行
                $btn2.bind('click', function () {
                    if (that.insertEditableRow(instance, i, 'after')) {
                        that.setToolBtns(instance);
                        that.resetOrder(instance);
                        that.setKeyboard(instance);
                    }
                });
                // 删除当前行
                $btn3.bind('click', function () {
                    if (that.removeEditableRow(instance, i)) {
                        $group.remove();
                        that.setToolBtns(instance);
                        that.resetOrder(instance);
                        that.setKeyboard(instance);
                    }
                });

                $group.appendTo($parent);
            }
        },

        // 重置行序号
        resetOrder: function (instance) {
            let columns = instance.configs['columns'];

            // 没有序号列
            if (!this.isArray(columns)) {
                return;
            }
            let length = columns.length;
            if (length == 0) {
                return;
            }

            // 计算哪几列是序号列
            let orderColumns = [];
            for (let i = 0; i < length; i++) {
                let column = columns[i];
                if (this.isNumber(column)) {
                    orderColumns.push(i);
                }
            }

            // 序号值重新按连续数字显示
            let rows = instance.editable_rows;
            let rowCnt = rows.length, columnCnt = rows[0].find('td').length;
            for (let i = 0; i < rowCnt; i++) {
                for (let j = 0; j < columnCnt; j++) {
                    if (this.inArray(j, orderColumns)) {
                        let $td = rows[i].find('td:eq(' + j + ')');
                        $td.html(this.renderOrder(i + 1));
                    }
                }
            }
        },

        // 返回序号列内容
        renderOrder: function (order) {
            return '<div style="display:block;width:auto;height:auto;text-align:center;">' + order + '</div>';
        },

        // 插入可编辑行
        insertEditableRow: function (instance, index, direct) {
            let rows = instance.editable_rows;
            let $row = rows[index];
            if ($row) {

                let rowCnt = rows.length;
                let rowMax = instance.configs['editable_row_max'];
                if (rowCnt >= rowMax) {
                    let msg = this.lang('cannot insert more rows', rowMax);
                    console.log(instance.element_key + ': ' + msg);
                    layer.msg(msg);
                    return false;
                }

                let i = rowCnt + 1;
                let $table = instance.target, $tbody = $table.find('tbody');
                let $columns = $row.find('td'), columnCnt = $columns.length;
                let $tr = $('<tr></tr>');
                for (let j = 0; j < columnCnt; j++) {
                    let $td = $('<td></td>'), textValue = '', textAlign = $columns.eq(j).css('textAlign');
                    let $editor = this.createEditor(instance, 'insert', i, j, textValue, textAlign);
                    $td.html($editor).css({ padding: 0, textAlign: textAlign });
                    $tr.append($td);
                }
                if (direct == 'after') {
                    $tbody.find('tr:eq(' + index + ')').after($tr);
                    rows.splice(index + 1, 0, $tr);
                } else if (direct == 'before') {
                    $tbody.find('tr:eq(' + index + ')').before($tr);
                    rows.splice(index, 0, $tr);
                }
                return true;
            }
            return false;
        },

        // 移除可编辑行
        removeEditableRow: function (instance, index) {
            let rows = instance.editable_rows;
            let $row = rows[index];
            if ($row) {

                let rowCnt = rows.length;
                if (rowCnt <= 1) {
                    let msg = this.lang('the last row cannot be deleted');
                    console.log(instance.element_key + ': ' + msg);
                    layer.msg(msg);
                    return false;
                }

                $row.remove();
                rows.splice(index, 1);
                return true;
            }
            return false;
        },

        // 创建编辑器，参数分别为：实例，模式（转换、添加或插入），行索引，列索引，列原始数据，列原始对其方式
        createEditor: function (instance, mode, rowIndex, colIndex, textValue, textAlign) {
            let columns = instance.configs['columns'], column = columns[colIndex];

            // 布尔型表示不编辑，仅显示空字符串
            // 数字型表示不编辑，仅显示序号
            // 字符型表示不编辑，仅直接显示该字符串
            if (this.isBoolean(column)) {
                return '';
            } else if (this.isNumber(column)) {
                let existableRowCnt = instance.existable_rows.length, order = 1;
                if (mode == 'change') {
                    order = existableRowCnt;
                } else if (mode == 'attach' || mode == 'insert') {
                    order = existableRowCnt + rowIndex + 1;
                }
                return this.renderOrder(order);
            } else if (this.isString(column)) {
                return column;
            }

            // 判断是否为json对象
            if (!this.isJsonObject(column)) {
                column = {};
            }

            let style = {
                width: '100%',
                height: '100%',
                textAlign: textAlign,
                boxSizing: 'border-box'
            };

            // 空的JSON对象
            let autoName = instance.element_key + '__tr' + rowIndex + 'td' + colIndex;
            if (JSON.stringify(column) == '{}') {
                return this.textEditor(autoName, textValue, column, style);
            }

            let type = column['type'] || 'text',
                name = column['name'] || autoName,
                value = textValue || (column['value'] || '');

            // 插入模式
            if (mode == 'insert') {
                value = textValue;
            }

            // 样式覆盖
            style = Object.assign({}, style, column['style'] || {});
            style['width'] = column['width'] || '100%';
            style['height'] = column['height'] || '100%';
            style['textAlign'] = textAlign || (column['align'] || '');

            return this[type.toLowerCase() + 'Editor'](name, value, column, style);
        },

        // 文本框编辑器
        textEditor: function (name, value, column, style) {
            let readonly = column['readonly'] || false;
            let $editor = $('<input type="text" name="' + name + '" value="' + value + '" />').css(style).prop('readonly', readonly);
            return $editor;
        },

        // 下拉选择框编辑器
        selectEditor: function (name, value, column, style) {
            let readonly = column['readonly'] || false;
            let values = column['values'] || [];
            let options = '<option value=""></option>', optionValueCnt = 0;
            if (this.isJsonObject(values)) {
                for (let v in values) {
                    let selected = (value == v ? ' selected="selected"' : '');
                    let text = values[v] || v;
                    options += '<option value="' + v + '"' + selected + '>' + text + '</option>';
                    optionValueCnt++;
                }
            }
            let $editor = $('<select name="' + name + '">' + options + '</select>').css(style).prop('readonly', readonly);
            return $editor;
        },

        // 复选框编辑器
        checkboxEditor: function (name, value, column, style) {
            let readonly = column['readonly'] || false;
            let $checkbox = $('<input type="checkbox" name="' + name + '" value="' + value + '" />').prop('readonly', readonly);
            let $editor = $('<div class="checkbox"><label></label></div>').css('textAlign', 'center').prepend($checkbox);
            return $editor;
        },

        // 日期选择框编辑器
        dateEditor: function (name, value, column, style) {
            let readonly = column['readonly'] || true;
            let $editor = $('<input class="funsent-etable-input-date" type="text" name="' + name + '" value="' + value + '" />').css(style).prop('readonly', readonly);
            laydate.render({ elem: $editor.get(0) });
            return $editor;
        },

        //TODO 整数框编辑器
        integerEditor: function (name, value, column, style) { },

        //TODO 数字框编辑器（含小数）
        numberEditor: function (name, value, column, style) { },

        // 是否为null
        isNull: function (value) {
            return getType(value) === '[object null]';
        },

        // 是否为null
        isUndefined: function (value) {
            return getType(value) === '[object undefined]';
        },

        // 是否是字符串
        isString: function (value) {
            return getType(value) === '[object string]';
        },

        // 是否为布尔值
        isBoolean: function (value) {
            return getType(value) === '[object boolean]';
        },

        // 是否为数字
        isNumber: function (value) {
            return getType(value) === '[object number]';
        },

        // 是否为数组
        isArray: function (value) {
            return getType(value) === '[object array]';
        },

        // 是否在数组中
        inArray: function (value, arr) {
            if (!this.isArray(arr)) {
                return false;
            }
            return arr.indexOf(value) !== -1;
        },

        // 是否为function
        isFunction: function (value) {
            return getType(value) === '[object function]';
        },

        // 是否为object
        isObject: function (value) {
            return typeof value === 'object' && getType(value) === '[object object]';
        },

        // 是否为json object，json对象没有length属性
        isJsonObject: function (value) {
            if (!this.isObject(value)) {
                return false;
            }
            return typeof (value.length) === 'undefined';
        },

        // 是否为Table元素对象
        isTableElement: function (value) {
            return getType(value) === '[object htmltableelement]';
        },

        // 去除所有空格后的字符串
        strip: function (str) {
            return str.replace(/[\s]/ig, '');
        },

        // 获取语言
        lang: function () {
            let name = arguments[0];
            if (!this.isString(name)) {
                name = '';
            }
            if (!name.length) {
                return '';
            }

            let langStr = langs[name];
            if (!this.isString(langStr)) {
                return name;
            }

            let args = Array.apply(null, arguments); // arguments转数组
            args.splice(0, 1, langStr);
            for (let i = 1, length = args.length; i < length; i++) {
                let pattern = "\\{" + (i - 1) + "\\}";
                let regx = new RegExp(pattern, 'g');
                langStr = langStr.replace(regx, args[i]);
            }
            return langStr;
        },

        // 输出错误信息
        consoleError: function (str) {
            console.log('%c' + str, 'color:red;');
        }
    };

    // 插件主体
    let etable = {

        // 初始化，支持链式调用
        init: function (element, opts) {
            let instance = _this.create(element, opts);
            if (instance) {
                _this.render(instance);
                _this.setToolBtns(instance);
                _this.setKeyboard(instance);
            }
            return this;
        },

        // 获取数据
        // 返回json对象数组的表单数据
        data: function (element) {
            return _this.data(element);
        },

        // 填充数据
        fill: function (element, records) {
            return _this.fill(element, records);
        },

        // 获取实例信息，供调试输出使用
        info: function (element, key) {
            return _this.info(element, key);
        }
    };

    // 插件对象暴露出去
    !('funsent' in window) && (window.funsent = {});
    !('etable' in window.funsent) && (window.funsent.etable = etable);

    if (!noGlobal) {
        window.jQuery = window.$ = jQuery;
    }
    return jQuery;
});
