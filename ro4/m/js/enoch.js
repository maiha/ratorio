/**
 * Enoch: 統合最適化モーダル
 * - 部位最適化: SELECTの選択肢を順番に試す
 * - 装備セット最適化: Stashアイテムの全組み合わせを試す
 */
$(document).ready(function() {

    class EnochModal {
        static METRICS = [
            { id: '#OBJID_ENOCH_DPS', label: 'DPS' },
            { id: '#OBJID_ENOCH_AVG_DMG', label: '期待値' },
            { id: '#OBJID_ENOCH_CRITICAL', label: 'Cri率' },
            { id: '#OBJID_ENOCH_ACC', label: '命中' },
            { id: '#OBJID_ENOCH_CAST_TIME', label: '詠唱' },
            { id: '#OBJID_ENOCH_SKILL_DELAY', label: 'ディレイ' },
            { id: '#OBJID_ENOCH_ASPD', label: 'ASPD' },
            { id: '#OBJID_ENOCH_TAKEN_DMG', label: '被ダメ' },
            { id: '#OBJID_SPAN_CHARA_MAXHP', label: 'HP' },
            { id: '#OBJID_SPAN_CHARA_MAXSP', label: 'SP' },
            { id: '#OBJID_SPAN_CHARA_ATK', label: 'ATK' },
            { id: '#OBJID_SPAN_CHARA_DEF', label: 'DEF' },
            { id: '#OBJID_SPAN_CHARA_MATK', label: 'MATK' },
            { id: '#OBJID_SPAN_CHARA_MDEF', label: 'MDEF' },
            { id: '#OBJID_SPAN_CHARA_HIT', label: 'HIT' },
            { id: '#OBJID_SPAN_CHARA_FLEE', label: 'FLEE' },
        ];

        static REGIONS = {
            HEAD_TOP:    { label: '頭上', equipId: '#OBJID_HEAD_TOP', cardIds: ['#OBJID_HEAD_TOP_CARD_1'] },
            HEAD_MID:    { label: '頭中', equipId: '#OBJID_HEAD_MID', cardIds: ['#OBJID_HEAD_MID_CARD_1'] },
            HEAD_UNDER:  { label: '頭下', equipId: '#OBJID_HEAD_UNDER', cardIds: [] },
            SHIELD:      { label: '盾', equipId: '#OBJID_SHIELD', cardIds: ['#OBJID_SHIELD_CARD_1'] },
            ARMS_RIGHT:  { label: '右手', equipId: '#OBJID_ARMS_RIGHT', cardIds: ['#OBJID_ARMS_RIGHT_CARD_1', '#OBJID_ARMS_RIGHT_CARD_2', '#OBJID_ARMS_RIGHT_CARD_3', '#OBJID_ARMS_RIGHT_CARD_4'] },
            ARMS_LEFT:   { label: '左手', equipId: '#OBJID_ARMS_LEFT', cardIds: ['#OBJID_ARMS_LEFT_CARD_1', '#OBJID_ARMS_LEFT_CARD_2', '#OBJID_ARMS_LEFT_CARD_3', '#OBJID_ARMS_LEFT_CARD_4'] },
            BODY:        { label: '鎧', equipId: '#OBJID_BODY', cardIds: ['#OBJID_BODY_CARD_1'] },
            SHOULDER:    { label: '肩', equipId: '#OBJID_SHOULDER', cardIds: ['#OBJID_SHOULDER_CARD_1'] },
            SHOES:       { label: '靴', equipId: '#OBJID_SHOES', cardIds: ['#OBJID_SHOES_CARD_1'] },
            ACC1:        { label: 'ア1', equipId: '#OBJID_ACCESSORY_1', cardIds: ['#OBJID_ACCESSORY_1_CARD_1', '#OBJID_ACCESSORY_1_CARD_4'] },
            ACC2:        { label: 'ア2', equipId: '#OBJID_ACCESSORY_2', cardIds: ['#OBJID_ACCESSORY_2_CARD_1', '#OBJID_ACCESSORY_2_CARD_4'] },
        };

        static LAYOUT = [
            ['HEAD_TOP',   'HEAD_MID'],
            ['HEAD_UNDER', 'BODY'],
            ['ARMS_RIGHT', ['ARMS_LEFT', 'SHIELD']],
            ['SHOULDER',   'SHOES'],
            ['ACC1',       'ACC2'],
        ];

        static REGION_LABELS = {
            0: '武器', 1: '左手', 2: '頭上段', 3: '頭中段', 4: '頭下段',
            5: '盾', 6: '鎧', 7: '肩', 8: '靴', 9: 'アクセ1', 10: 'アクセ2'
        };

        constructor() {
            this.$overlay = null;
            this.$modal = null;
            this.initialized = false;
            this.currentTab = 'select';

            // SELECT最適化用
            this.selectResults = [];
            this.selectRunning = false;
            this.selectInterval = null;
            this.selectedTarget = null;
            this.selectedMetric = '#OBJID_ENOCH_DPS';
            this.comboSelectedMetric = '#OBJID_ENOCH_DPS';

            // 組み合わせ最適化用
            this.comboCandidates = null;
            this.comboResults = [];
            this.comboRunning = false;
            this.comboLoadedSlotIndex = null;
            this.comboCombinations = null;
            this.comboCurrentIndex = 0;
            this.comboPrevCombo = null;
            this.comboBestIndex = -1;  // 最高結果のインデックス

            // 自動計算設定の退避用
            this._savedAutoCalcValue = null;
        }

        // 自動計算を抑制（実行開始時）
        suppressAutoCalc() {
            const $el = $('#OBJID_INPUT_ATTACK_METHOD_AUTO_CALC');
            this._savedAutoCalcValue = $el.val();
            $el.val('2');
        }

        // 自動計算を復元（実行終了時）
        restoreAutoCalc() {
            if (this._savedAutoCalcValue !== null) {
                $('#OBJID_INPUT_ATTACK_METHOD_AUTO_CALC').val(this._savedAutoCalcValue);
                this._savedAutoCalcValue = null;
            }
        }

        init() {
            if (this.initialized) return;
            this.$overlay = $('<div class="enoch-overlay"></div>').hide();
            this.$modal = $(this.buildModalHTML()).hide();
            $('body').append(this.$overlay, this.$modal);
            this.bindEvents();
            const $btn = $('<button type="button" class="enoch-open-button">イーノック</button>');
            $btn.on('click', () => this.open());
            $('#OBJID_ENOCH_BUTTON_AREA').append($btn);
            this.initialized = true;
        }

        buildModalHTML() {
            const metricOptions = EnochModal.METRICS.map(m =>
                `<option value="${m.id}">${m.label}</option>`
            ).join('');

            return `
                <div class="enoch-modal">
                    <div class="enoch-header">
                        <h3>イーノック</h3>
                        <button type="button" class="enoch-close">&times;</button>
                    </div>
                    <div class="enoch-tabs">
                        <button type="button" class="enoch-tab active" data-tab="select">部位最適化</button>
                        <button type="button" class="enoch-tab" data-tab="combo">装備セット最適化</button>
                    </div>
                    <div class="enoch-body">
                        <div class="enoch-tab-content" data-tab="select">
                            <div class="enoch-section">
                                <div class="enoch-section-title">評価値</div>
                                <div class="enoch-metric-grid"></div>
                            </div>
                            <div class="enoch-section">
                                <div class="enoch-section-title">対象</div>
                                <div class="enoch-region-grid"></div>
                            </div>
                            <div class="enoch-config">
                                <label>TopN: <input type="number" class="enoch-topn" value="10" min="1" max="100"></label>
                                <label>最大: <input type="number" class="enoch-max-count" value="999" min="1"></label>
                                <label>Slot≧: <input type="number" class="enoch-min-slot" value="0" min="0" max="4"></label>
                                <label>間隔ms: <input type="number" class="enoch-step-delay" value="200" min="50"></label>
                                <label>待ちms: <input type="number" class="enoch-render-delay" value="50" min="10"></label>
                            </div>
                            <div class="enoch-controls">
                                <span class="enoch-selected-info"></span>
                                <button type="button" class="enoch-start" disabled>▶ 実行</button>
                                <button type="button" class="enoch-stop" disabled>■ 停止</button>
                            </div>
                            <div class="enoch-progress"></div>
                            <div class="enoch-results"></div>
                        </div>
                        <div class="enoch-tab-content" data-tab="combo" style="display:none">
                            <div class="enoch-section">
                                <div class="enoch-section-title">評価値</div>
                                <div class="enoch-combo-metric-grid"></div>
                            </div>
                            <div class="enoch-combo-toolbar">
                                <span class="enoch-combo-toolbar-label">読取:</span>
                                <span class="enoch-combo-slot-buttons"></span>
                                <span class="enoch-combo-status"></span>
                            </div>
                            <div class="enoch-combo-candidates"></div>
                            <div class="enoch-config">
                                <label>TopN: <input type="number" class="enoch-combo-topn" value="10" min="1" max="100"></label>
                                <label>間隔ms: <input type="number" class="enoch-combo-step-delay" value="200" min="50"></label>
                                <label>待ちms: <input type="number" class="enoch-combo-render-delay" value="50" min="10"></label>
                            </div>
                            <div class="enoch-controls">
                                <span class="enoch-combo-count"></span>
                                <button type="button" class="enoch-combo-start" disabled>▶ 実行</button>
                                <button type="button" class="enoch-combo-stop" disabled>■ 停止</button>
                            </div>
                            <div class="enoch-combo-progress"></div>
                            <div class="enoch-combo-results"></div>
                            <div class="enoch-combo-export">
                                <button type="button" class="enoch-combo-tsv" disabled>TSVコピー</button>
                            </div>
                        </div>
                    </div>
                </div>`;
        }

        bindEvents() {
            this.$overlay.on('click', () => this.close());
            this.$modal.find('.enoch-close').on('click', () => this.close());
            this.$modal.on('click', '.enoch-tab', (e) => this.switchTab($(e.target).data('tab')));

            // SELECT最適化
            this.$modal.find('.enoch-start').on('click', () => this.runSelect());
            this.$modal.find('.enoch-stop').on('click', () => this.stopSelect());
            this.$modal.on('click', '.enoch-metric-btn', (e) => this.selectMetric($(e.target).data('metric')));
            this.$modal.on('click', '.enoch-equip-btn:not(:disabled), .enoch-card-btn:not(:disabled)', (e) => {
                this.selectTarget($(e.target).data('target'));
            });
            this.$modal.on('click', '.enoch-result-link', (e) => {
                e.preventDefault();
                if (this.selectedTarget) {
                    $(this.selectedTarget).val($(e.target).data('item-id')).trigger('change');
                    calc();
                }
            });

            // 組み合わせ最適化
            this.$modal.on('click', '.enoch-combo-metric-btn', (e) => this.selectComboMetric($(e.target).data('metric')));
            this.$modal.on('click', '.enoch-slot-btn', (e) => this.loadStashSlot($(e.target).data('slot-index')));
            this.$modal.find('.enoch-combo-start').on('click', () => this.runCombo());
            this.$modal.find('.enoch-combo-stop').on('click', () => this.stopCombo());
            this.$modal.find('.enoch-combo-tsv').on('click', () => this.exportComboTSV());
            this.$modal.on('click', '.enoch-combo-select-all', (e) => this.toggleAllInRegion($(e.target).data('region'), true));
            this.$modal.on('click', '.enoch-combo-deselect-all', (e) => this.toggleAllInRegion($(e.target).data('region'), false));
            this.$modal.on('change', '.enoch-combo-item-check', (e) => {
                const $cb = $(e.target);
                this.comboCandidates[$cb.data('region')][$cb.data('index')].checked = $cb.prop('checked');
                this.updateCombinationCount();
            });
            this.$modal.on('click', '.enoch-combo-apply', (e) => this.applyCombo($(e.currentTarget).data('result-index')));
        }

        // タブ
        switchTab(tab) {
            this.currentTab = tab;
            this.$modal.find('.enoch-tab').removeClass('active');
            this.$modal.find(`.enoch-tab[data-tab="${tab}"]`).addClass('active');
            this.$modal.find('.enoch-tab-content').hide();
            this.$modal.find(`.enoch-tab-content[data-tab="${tab}"]`).show();
            if (tab === 'combo') {
                this.renderComboMetricGrid();
                this.renderSlotButtons();
                if (!this.comboCandidates) {
                    this.loadStashSlot(window.StashUI?.data?.getCurrentSlotIndex?.() || 1);
                }
            }
        }

        renderSlotButtons() {
            const $container = this.$modal.find('.enoch-combo-slot-buttons').empty();
            const slots = window.StashUI?.data?.getSlots?.() || [];
            if (slots.length === 0) {
                $container.html('<span class="enoch-no-stash">Stashなし</span>');
                return;
            }
            slots.forEach((slot, i) => {
                const slotIndex = i + 1;
                const isLoaded = slotIndex === this.comboLoadedSlotIndex;
                $container.append($(`<button type="button" class="enoch-slot-btn ${isLoaded ? 'loaded' : ''}" data-slot-index="${slotIndex}">${slot.name}</button>`));
            });
        }

        // モーダル開閉
        open(tab) {
            this.init();
            tab = tab || this.currentTab || 'select';
            this.switchTab(tab);
            if (tab === 'select') {
                this.renderMetricGrid();
                this.renderRegionGrid();
                if (this.selectResults.length > 0) {
                    this.renderSelectResults(parseInt(this.$modal.find('.enoch-topn').val()) || 10, true);
                }
            } else if (tab === 'combo') {
                this.renderComboMetricGrid();
                if (this.comboResults.length > 0) {
                    this.renderComboResults(parseInt(this.$modal.find('.enoch-combo-topn').val()) || 10, true);
                }
                if (this.comboCandidates) {
                    this.renderComboCandidates();
                    this.updateCombinationCount();
                }
            }
            this.$overlay.show();
            this.$modal.show();
        }

        close() {
            if (this.selectRunning || this.comboRunning) {
                if (!confirm('実行中です。中断して閉じますか？')) return;
                this.stopSelect();
                this.stopCombo();
            }
            this.$overlay.hide();
            this.$modal.hide();
        }

        // SELECT最適化
        renderMetricGrid() {
            const $grid = this.$modal.find('.enoch-metric-grid').empty();
            EnochModal.METRICS.forEach(m => {
                $grid.append($(`<button type="button" class="enoch-metric-btn ${m.id === this.selectedMetric ? 'selected' : ''}" data-metric="${m.id}">${m.label}</button>`));
            });
        }

        renderRegionGrid() {
            const $container = this.$modal.find('.enoch-region-grid').empty();
            const $table = $('<table class="enoch-region-table"></table>');
            for (const [leftSpec, rightSpec] of EnochModal.LAYOUT) {
                const $tr = $('<tr></tr>');
                $tr.append(this.renderLayoutCell(leftSpec));
                $tr.append(this.renderLayoutCell(rightSpec));
                $table.append($tr);
            }
            $container.append($table);
        }

        renderLayoutCell(spec) {
            const $td = $('<td></td>');
            if (!spec) return $td;
            for (const key of (Array.isArray(spec) ? spec : [spec])) {
                const region = EnochModal.REGIONS[key];
                if (region && this.isSelectVisible(region.equipId)) {
                    $td.append(this.renderRegionCell(region));
                }
            }
            return $td;
        }

        renderRegionCell(region) {
            const $cell = $('<div class="enoch-region"></div>');
            $cell.append($(`<button type="button" class="enoch-equip-btn ${this.selectedTarget === region.equipId ? 'selected' : ''}" data-target="${region.equipId}">${region.label}</button>`));
            for (let i = 0; i < region.cardIds.length; i++) {
                const cardId = region.cardIds[i];
                if (!this.isSelectVisible(cardId)) continue;
                $cell.append($(`<button type="button" class="enoch-card-btn ${this.selectedTarget === cardId ? 'selected' : ''}" data-target="${cardId}">${i === 0 ? 'カード' : 'エンチャント'}</button>`));
            }
            return $cell;
        }

        isSelectVisible(selectId) {
            const $el = $(selectId);
            if ($el.length === 0 || $el.css('visibility') === 'hidden') return false;
            if ($el.closest('[style*="visibility"][style*="hidden"]').length > 0) return false;
            return $el.is(':visible');
        }

        selectMetric(metricId) {
            this.selectedMetric = metricId;
            this.$modal.find('.enoch-metric-btn').removeClass('selected');
            this.$modal.find(`.enoch-metric-btn[data-metric="${metricId}"]`).addClass('selected');
        }

        // 装備セット最適化用
        renderComboMetricGrid() {
            const $grid = this.$modal.find('.enoch-combo-metric-grid').empty();
            EnochModal.METRICS.forEach(m => {
                $grid.append($(`<button type="button" class="enoch-combo-metric-btn ${m.id === this.comboSelectedMetric ? 'selected' : ''}" data-metric="${m.id}">${m.label}</button>`));
            });
        }

        selectComboMetric(metricId) {
            this.comboSelectedMetric = metricId;
            this.$modal.find('.enoch-combo-metric-btn').removeClass('selected');
            this.$modal.find(`.enoch-combo-metric-btn[data-metric="${metricId}"]`).addClass('selected');
        }

        selectTarget(targetId) {
            this.selectedTarget = targetId;
            this.$modal.find('.enoch-equip-btn, .enoch-card-btn').removeClass('selected');
            this.$modal.find(`[data-target="${targetId}"]`).addClass('selected');
            this.$modal.find('.enoch-selected-info').text(`${targetId} (${$(targetId).find('option').length}件)`);
            this.$modal.find('.enoch-start').prop('disabled', false);
        }

        runSelect() {
            this.stopSelect();
            this.selectResults = [];
            this.selectRunning = true;
            this.suppressAutoCalc();
            this.$modal.find('.enoch-start').prop('disabled', true);
            this.$modal.find('.enoch-stop').prop('disabled', false);

            const targetId = this.selectedTarget;
            if (!targetId) {
                alert('対象を選択してください');
                this.stopSelect();
                return;
            }

            const topN = parseInt(this.$modal.find('.enoch-topn').val()) || 10;
            const maxCount = parseInt(this.$modal.find('.enoch-max-count').val()) || 999;
            const minSlot = parseInt(this.$modal.find('.enoch-min-slot').val()) || 0;
            const stepDelay = parseInt(this.$modal.find('.enoch-step-delay').val()) || 200;
            const renderDelay = parseInt(this.$modal.find('.enoch-render-delay').val()) || 50;

            const $select = $(targetId);
            const $options = $select.find('option');
            const stopIndex = Math.min(maxCount, $options.length);
            const $metricEl = $(this.selectedMetric);

            if ($metricEl.length === 0) {
                alert(`評価値要素が見つかりません: ${this.selectedMetric}`);
                this.stopSelect();
                return;
            }

            let index = 0;
            this.$highlightedEl = $metricEl.css('background-color', 'yellow');

            const checkValue = () => {
                if (!this.selectRunning || index >= stopIndex) {
                    this.stopSelect();
                    this.renderSelectResults(topN, true);
                    return;
                }

                const $option = $options.eq(index);
                const itemId = $option.val();
                const itemName = $option.text();
                const slot = (typeof ItemObjNew !== 'undefined' && ItemObjNew[itemId])
                    ? (ItemObjNew[itemId][ITEM_DATA_INDEX_SLOT] ?? 0) : 0;

                $select.val(itemId).trigger('change');
                calc();

                setTimeout(() => {
                    if (!this.selectRunning) return;
                    const rawText = $metricEl.text();
                    const value = parseFloat(rawText.replace(/,/g, '')) || 0;
                    if (slot >= minSlot) {
                        this.selectResults.push({ itemId, name: itemName, value, text: rawText });
                        this.selectResults.sort((a, b) => b.value - a.value);
                    }
                    const pct = Math.round(((index + 1) / stopIndex) * 100);
                    this.$modal.find('.enoch-progress').html(`
                        <div class="enoch-progress-bar"><div class="enoch-progress-fill" style="width: ${pct}%"></div></div>
                        <div class="enoch-progress-text">${index + 1} / ${stopIndex} (${pct}%) - ${itemName}</div>
                    `);
                    this.renderSelectResults(topN, false);
                    index++;
                }, renderDelay);
            };

            this.selectInterval = setInterval(checkValue, stepDelay);
        }

        stopSelect() {
            this.selectRunning = false;
            if (this.selectInterval) {
                clearInterval(this.selectInterval);
                this.selectInterval = null;
            }
            this.$modal.find('.enoch-start').prop('disabled', false);
            this.$modal.find('.enoch-stop').prop('disabled', true);
            if (this.$highlightedEl) {
                this.$highlightedEl.css('background-color', '');
                this.$highlightedEl = null;
            }
            this.restoreAutoCalc();
        }

        renderSelectResults(topN, isFinal = false) {
            const top = this.selectResults.slice(0, topN);
            if (top.length === 0) return;
            let html = `<table class="enoch-results-table"><thead><tr><th>順位</th><th>アイテム</th><th>値</th></tr></thead><tbody>`;
            top.forEach((item, idx) => {
                html += `<tr><td>${idx + 1}</td><td><a href="#" class="enoch-result-link" data-item-id="${item.itemId}">${item.name}</a></td><td>${item.text}</td></tr>`;
            });
            html += '</tbody></table>';
            if (isFinal) html += `<div class="enoch-final-message">完了: ${this.selectResults.length}件を評価</div>`;
            this.$modal.find('.enoch-results').html(html);
        }

        // 組み合わせ最適化
        loadStashSlot(slotIndex) {
            const slots = window.StashUI?.data?.getSlots?.() || [];
            if (slots.length === 0) {
                this.$modal.find('.enoch-combo-status').text('Stashなし');
                return;
            }
            const slot = slots[slotIndex - 1];
            if (!slot) {
                this.$modal.find('.enoch-combo-status').text('スロットが見つかりません');
                return;
            }

            // スナップショット作成と候補準備を統合
            const candidates = {};
            if (slot?.entries) {
                for (const [regionId, items] of slot.entries()) {
                    candidates[regionId] = items.map((item, index) => ({
                        itemId: item.itemId,
                        itemRefined: item.itemRefined,
                        cardIds: [...item.cardIds],
                        displayName: item.toDisplayString?.(',', false) || `${item.itemId}`,
                        checked: true,
                        originalIndex: index
                    }));
                }
            }

            if (Object.keys(candidates).length === 0) {
                this.$modal.find('.enoch-combo-status').text(`${slot.name}: アイテムなし`);
                this.comboCandidates = null;
                this.comboLoadedSlotIndex = null;
                this.renderSlotButtons();
                this.renderComboCandidates();
                return;
            }

            this.comboCandidates = candidates;
            this.comboResults = [];
            this.comboLoadedSlotIndex = slotIndex;
            this.renderSlotButtons();
            this.renderComboCandidates();
            this.updateCombinationCount();
            this.$modal.find('.enoch-combo-status, .enoch-combo-results, .enoch-combo-progress').empty();
        }

        renderComboCandidates() {
            const $container = this.$modal.find('.enoch-combo-candidates').empty();
            if (!this.comboCandidates) {
                $container.html('<div class="enoch-combo-empty">「現在のStashを読込」をクリック</div>');
                return;
            }
            const regionIds = Object.keys(this.comboCandidates).map(Number).sort((a, b) => a - b);
            if (regionIds.length === 0) {
                $container.html('<div class="enoch-combo-empty">アイテムがありません</div>');
                return;
            }
            for (const regionId of regionIds) {
                const items = this.comboCandidates[regionId];
                const label = EnochModal.REGION_LABELS[regionId] || `部位${regionId}`;
                const $region = $(`
                    <div class="enoch-combo-region" data-region="${regionId}">
                        <div class="enoch-combo-region-header">
                            <span class="enoch-combo-region-label">${label} (${items.length})</span>
                            <span class="enoch-combo-region-actions">
                                <button type="button" class="enoch-combo-select-all" data-region="${regionId}">全選択</button>
                                <button type="button" class="enoch-combo-deselect-all" data-region="${regionId}">全解除</button>
                            </span>
                        </div>
                        <div class="enoch-combo-region-items"></div>
                    </div>
                `);
                const $items = $region.find('.enoch-combo-region-items');
                items.forEach((item, index) => {
                    $items.append($(`<label class="enoch-combo-item"><input type="checkbox" class="enoch-combo-item-check" data-region="${regionId}" data-index="${index}" ${item.checked ? 'checked' : ''}><span class="enoch-combo-item-name">${item.displayName}</span></label>`));
                });
                $container.append($region);
            }
        }

        toggleAllInRegion(regionId, checked) {
            const items = this.comboCandidates[regionId];
            if (!items) return;
            items.forEach(item => item.checked = checked);
            this.$modal.find(`.enoch-combo-item-check[data-region="${regionId}"]`).prop('checked', checked);
            this.updateCombinationCount();
        }

        updateCombinationCount() {
            if (!this.comboCandidates) return;
            const counts = Object.values(this.comboCandidates)
                .map(items => items.filter(item => item.checked).length)
                .filter(count => count > 0);
            const count = counts.length === 0 ? 0 : counts.reduce((acc, c) => acc * c, 1);
            const $countEl = this.$modal.find('.enoch-combo-count');
            if (count === 0) {
                $countEl.html('<span class="enoch-warning">チェックなし</span>');
                this.$modal.find('.enoch-combo-start').prop('disabled', true);
            } else {
                $countEl.text(`${count.toLocaleString()}パターン`);
                this.$modal.find('.enoch-combo-start').prop('disabled', false);
            }
        }

        generateCombinations() {
            const entries = Object.entries(this.comboCandidates)
                .map(([regionId, items]) => ({ regionId: Number(regionId), items: items.filter(item => item.checked) }))
                .filter(entry => entry.items.length > 0);
            if (entries.length === 0) return [];
            const cartesian = (arr) => {
                if (arr.length === 0) return [[]];
                const [first, ...rest] = arr;
                const restCombos = cartesian(rest);
                const result = [];
                for (const item of first.items) {
                    for (const combo of restCombos) {
                        result.push([{ regionId: first.regionId, item }, ...combo]);
                    }
                }
                return result;
            };
            return cartesian(entries);
        }

        async runCombo() {
            this.comboRunning = true;
            this.suppressAutoCalc();
            this.$modal.find('.enoch-combo-start').prop('disabled', true);
            this.$modal.find('.enoch-combo-stop').prop('disabled', false);
            this.$modal.find('.enoch-combo-tsv').prop('disabled', true);

            const metric = this.comboSelectedMetric;
            const topN = parseInt(this.$modal.find('.enoch-combo-topn').val()) || 10;
            const stepDelay = parseInt(this.$modal.find('.enoch-combo-step-delay').val()) || 150;
            const renderDelay = parseInt(this.$modal.find('.enoch-combo-render-delay').val()) || 50;

            const newCombinations = this.generateCombinations();
            const isResume = this.comboCombinations &&
                             this.comboCombinations.length === newCombinations.length &&
                             this.comboCurrentIndex > 0 &&
                             this.comboCurrentIndex < newCombinations.length;

            if (!isResume) {
                this.comboCombinations = newCombinations;
                this.comboCurrentIndex = 0;
                this.comboPrevCombo = null;
                this.comboResults = [];
                this.comboBestIndex = -1;
            }

            const combinations = this.comboCombinations;
            const totalCount = combinations.length;

            for (let i = this.comboCurrentIndex; i < totalCount && this.comboRunning; i++) {
                const combo = combinations[i];
                this.comboCurrentIndex = i;
                this.updateComboHighlights(combo);

                for (const { regionId, item } of combo) {
                    if (this.comboPrevCombo) {
                        const prevItem = this.comboPrevCombo.find(c => c.regionId === regionId)?.item;
                        if (prevItem && prevItem.itemId === item.itemId &&
                            prevItem.itemRefined === item.itemRefined &&
                            JSON.stringify(prevItem.cardIds) === JSON.stringify(item.cardIds)) {
                            continue;
                        }
                    }
                    try {
                        StashEquipBinder.fromRegionId(regionId).apply(item);
                    } catch (e) {
                        console.warn(`Enoch: Failed to apply item for region ${regionId}`, e);
                    }
                }

                this.comboPrevCombo = combo;
                calc();
                await new Promise(r => setTimeout(r, renderDelay));

                const rawText = $(metric).text();
                const value = parseFloat(rawText.replace(/,/g, '')) || 0;
                this.comboResults.push({ combo, value, displayValue: rawText });

                // ベストを更新
                if (this.comboBestIndex < 0 || value > this.comboResults[this.comboBestIndex].value) {
                    this.comboBestIndex = this.comboResults.length - 1;
                }
                this.comboCurrentIndex = i + 1;

                const pct = Math.round((this.comboCurrentIndex / totalCount) * 100);
                const comboStr = combo.map(c => `${EnochModal.REGION_LABELS[c.regionId] || c.regionId}: ${c.item.displayName}`).join(', ');
                this.$modal.find('.enoch-combo-progress').html(`
                    <div class="enoch-progress-bar"><div class="enoch-progress-fill" style="width: ${pct}%"></div></div>
                    <div class="enoch-progress-text">${this.comboCurrentIndex}/${totalCount} (${pct}%)</div>
                    <div class="enoch-progress-current">${comboStr}</div>
                `);
                this.renderComboResults(topN, false);

                if (i < totalCount - 1) await new Promise(r => setTimeout(r, stepDelay));
            }

            this.comboRunning = false;
            this.$modal.find('.enoch-combo-start').prop('disabled', false);
            this.$modal.find('.enoch-combo-stop').prop('disabled', true);
            this.restoreAutoCalc();
            this.renderComboResults(topN, true);
            this.showBestHighlightsOnly();
        }

        // 完了時: ベストのみ表示（processing, done を解除）
        showBestHighlightsOnly() {
            this.$modal.find('.enoch-combo-item').removeClass('enoch-combo-processing enoch-combo-done enoch-combo-best');
            const bestCombo = this.comboBestIndex >= 0 ? this.comboResults[this.comboBestIndex]?.combo : null;
            if (!bestCombo) return;
            for (const { regionId, item } of bestCombo) {
                const $item = this.$modal.find(`.enoch-combo-item-check[data-region="${regionId}"][data-index="${item.originalIndex}"]`).closest('.enoch-combo-item');
                $item.addClass('enoch-combo-best');
            }
        }

        updateComboHighlights(combo) {
            this.$modal.find('.enoch-combo-item').removeClass('enoch-combo-processing enoch-combo-done enoch-combo-best');

            // ベストコンボのアイテムを特定
            const bestCombo = this.comboBestIndex >= 0 ? this.comboResults[this.comboBestIndex]?.combo : null;
            const bestItems = {};
            if (bestCombo) {
                for (const { regionId, item } of bestCombo) {
                    bestItems[regionId] = item.originalIndex;
                }
            }

            for (const { regionId, item } of combo) {
                const currentIndex = item.originalIndex;
                const items = this.comboCandidates[regionId];
                if (!items) continue;
                for (const candidateItem of items) {
                    if (!candidateItem.checked) continue;
                    const $item = this.$modal.find(`.enoch-combo-item-check[data-region="${regionId}"][data-index="${candidateItem.originalIndex}"]`).closest('.enoch-combo-item');
                    if ($item.length === 0) continue;

                    // 優先度: done < best < processing
                    if (candidateItem.originalIndex < currentIndex) {
                        $item.addClass('enoch-combo-done');
                    }
                    if (bestItems[regionId] === candidateItem.originalIndex) {
                        $item.addClass('enoch-combo-best');
                    }
                    if (candidateItem.originalIndex === currentIndex) {
                        $item.addClass('enoch-combo-processing');
                    }
                }
            }
        }

        stopCombo() {
            this.comboRunning = false;
            this.$modal.find('.enoch-combo-start').prop('disabled', false);
            this.$modal.find('.enoch-combo-stop').prop('disabled', true);
            this.restoreAutoCalc();
            this.showBestHighlightsOnly();
        }

        renderComboResults(topN, isFinal = false) {
            const sorted = [...this.comboResults].sort((a, b) => b.value - a.value);
            this.comboSortedResults = sorted;
            const top = sorted.slice(0, topN);
            if (top.length === 0) return;

            let html = `<table class="enoch-results-table"><thead><tr><th>順位</th><th>組み合わせ</th><th>値</th></tr></thead><tbody>`;
            top.forEach((result, index) => {
                const comboStr = result.combo.map(c => c.item.displayName).join(', ');
                html += `<tr class="${index === 0 ? 'enoch-best' : ''}"><td>${index + 1}</td><td class="enoch-combo-cell enoch-combo-apply" data-result-index="${index}">${comboStr}</td><td>${result.displayValue}</td></tr>`;
            });
            html += '</tbody></table>';
            if (isFinal) {
                html += `<div class="enoch-final-message">完了: ${this.comboResults.length}パターンを評価</div>`;
                this.$modal.find('.enoch-combo-tsv').prop('disabled', false);
            }
            this.$modal.find('.enoch-combo-results').html(html);
        }

        applyCombo(resultIndex) {
            const result = this.comboSortedResults?.[resultIndex];
            if (!result) return;
            for (const { regionId, item } of result.combo) {
                try {
                    StashEquipBinder.fromRegionId(regionId).apply(item);
                } catch (e) {
                    console.warn(`Enoch: Failed to apply item for region ${regionId}`, e);
                }
            }
            StAllCalc();
            AutoCalc();
            LoadSelect2();
            this.stopCombo();
            this.$overlay.hide();
            this.$modal.hide();
        }

        exportComboTSV() {
            if (this.comboResults.length === 0) {
                alert('結果がありません');
                return;
            }
            const sorted = [...this.comboResults].sort((a, b) => b.value - a.value);
            const metricLabel = EnochModal.METRICS.find(m => m.id === this.comboSelectedMetric)?.label || '';
            const regionIds = [...new Set(sorted[0].combo.map(c => c.regionId))].sort((a, b) => a - b);
            const regionHeaders = regionIds.map(id => EnochModal.REGION_LABELS[id] || `部位${id}`);
            let tsv = `順位\t${regionHeaders.join('\t')}\t${metricLabel}\n`;
            sorted.forEach((result, index) => {
                const itemsByRegion = {};
                result.combo.forEach(c => { itemsByRegion[c.regionId] = c.item.displayName; });
                tsv += `${index + 1}\t${regionIds.map(id => itemsByRegion[id] || '').join('\t')}\t${result.value}\n`;
            });
            navigator.clipboard.writeText(tsv).then(() => {
                const $btn = this.$modal.find('.enoch-combo-tsv');
                const orig = $btn.text();
                $btn.text('コピー完了');
                setTimeout(() => $btn.text(orig), 2000);
            }).catch(() => alert('コピーに失敗しました'));
        }
    }

    window.EnochModal = new EnochModal();
    if ($('#OBJID_ENOCH_BUTTON_AREA').length) {
        window.EnochModal.init();
    }
});
