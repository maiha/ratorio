$(document).ready(function () {
    class StashItem {
		constructor(itemId, itemRefined, cardIds) {
			const itemData = ItemObjNew[itemId];
			this.itemId = itemId;
			this.itemRefined = itemRefined;
			this.cardIds = cardIds;
			this.itemName = itemData?.[ITEM_DATA_INDEX_NAME] || '(不明)';
			this.key = JSON.stringify([itemId, itemRefined, cardIds]);
		}

		equals(other) {
			return this.key === other.key;
		}

        toDisplayString(delimiter = '', compactDuplicates = false) {
            const prefix = this.itemRefined > 0 ? `+${this.itemRefined} ` : '';
            const isEmpty = this.cardIds.every(id => id === 0);
            if (isEmpty) return `${prefix}${this.itemName}`;
            let cardNames = this.cardIds.map(id => CardObjNew[id]?.[CARD_DATA_INDEX_NAME] || '').filter(name => name !== '(カードなし)');
            if (cardNames.length > 0 && compactDuplicates) {
                let result = [];
                let count = 1;
                for (let i = 0; i < cardNames.length; i++) {
                    if (i + 1 < cardNames.length && cardNames[i] === cardNames[i + 1]) {
                        count++;
                    } else {
                        result.push(count > 1 ? `${cardNames[i]}#x${count}` : cardNames[i]);
                        count = 1;
                    }
                }
                return `${prefix}${this.itemName}${delimiter}(${result.join(',')})`;
            } else if (cardNames.length > 0) {
                return `${prefix}${this.itemName}${delimiter}(${cardNames.join(',')})`;
            }
            return `${prefix}${this.itemName}`;
        }        
    }
    
    class StashSlot {
        constructor(name, type = 'stash') {
            this.name = name;
            this.type = type;
            this.regionMap = new Map();
        }

        setType(type) {
            this.type = type;
        }
    
        addItem(regionId, item) {
            const list = this.regionMap.get(regionId) || [];
            if (!list.some(existing => item.equals(existing))) {
                list.push(item);
                this.regionMap.set(regionId, list);
            }
        }
    
        removeItem(regionId, item) {
            if (!this.regionMap.has(regionId)) return;
            const list = this.regionMap.get(regionId).filter(existing => !item.equals(existing));
            if (list.length === 0) {
                this.regionMap.delete(regionId);
            } else {
                this.regionMap.set(regionId, list);
            }
        }

        setName(name) {
            this.name = name;
        }
    
        entries() {
            return this.regionMap.entries();
        }

        static TYPES = new Map([
            ['stash', '倉庫'],
            ['preset', '装備セット']
        ]);

        static getTypeLabel(type) {
            return this.TYPES.get(type);
        }
    }
    
    class StashData {
        static STORAGE_KEY_SLOTS = 'ratorioStashSlotData';
        static STORAGE_KEY_SLOT_INDEX = 'ratorioStashCurrentlotIndex';
    
        #slots = [];
        #currentIndex = 1;

        constructor() {
            try {
                this.#slots = StashData.loadSlotsFromStorage();
            } catch (e) {
                console.warn('破損または旧形式のデータを検出、初期化します', e);
                localStorage.removeItem(StashData.STORAGE_KEY_SLOTS);
                this.#slots = [new StashSlot('スロット1', 'stash')];
            }
            this.setCurrentSlotIndex(this.loadCurrentSlotIndex(), 'loaded from storage');
            this.ensureAtLeastOneSlot();
            this.ensureValidIndex('constructor');
        }

        ensureAtLeastOneSlot() {
            if (this.#slots.length === 0) {
                console.log('ensureAtLeastOneSlot', '初期化します');
                this.#slots.push(new StashSlot('スロット1', 'stash'));
                this.save();
                this.setCurrentSlotIndex(1, 'slotsが空のためリセット');
            }
        }

        ensureValidIndex(caller) {
            const n = this.#currentIndex;
            if (isNaN(n)) {
                this.setCurrentSlotIndex(1, `${caller}:現在値(${n})がNaN`);
            } else if (n < 1) {
                this.setCurrentSlotIndex(1, `${caller}:現在値(${n})1未満`);
            } else if (n > this.#slots.length) {
                this.setCurrentSlotIndex(this.#slots.length, `${caller}:現在値(${n})がslots範囲(${this.#slots.length})外`);
            }
        }

        getSlot(index) {
            return this.#slots[index - 1];
        }
    
        getSlots() {
            return this.#slots;
        }
    
        counts() {
            return this.#slots.length;
        }

        getCurrentSlot() {
            this.ensureAtLeastOneSlot();
            const slot = this.#slots[this.#currentIndex - 1];
            return slot ?? this.#slots[0];
        }

        getCurrentSlotIndex() {
            this.ensureAtLeastOneSlot();
            return this.#currentIndex;
        }

        isValidIndex(n) {
            return !isNaN(n) && n >= 1 && n <= this.#slots.length;
        }

        converToValidIndex(n) {
            return this.isValidIndex(n) ? n : 1;
        }
        
        loadCurrentSlotIndex() {
            try {
                const n = parseInt(localStorage.getItem(StashData.STORAGE_KEY_SLOT_INDEX), 10);
                return this.converToValidIndex(n);
            } catch (e) {
                console.warn('ストレージからIndexの読み込みが失敗', e);
                this.setCurrentSlotIndex(1, 'ストレージから値が読み取れなかったため初期化');
                return 1;
            }
        }

        setCurrentSlotIndex(n, caller) {
            if (this.isValidIndex(n)) {
                console.debug('setCurrentSlotIndex', n, `by ${caller}`);
            } else {
                console.warn('setCurrentSlotIndex', n, `by ${caller}`);
            }
            this.#currentIndex = n;
            localStorage.setItem(StashData.STORAGE_KEY_SLOT_INDEX, n);
        }
    
        createSlot(name, type) {
            if (this.#slots.some(s => s.name === name)) return false;
            this.#slots.push(new StashSlot(name, type));
            this.save();
            return true;
        }
    
        deleteSlotByIndex(i) {
            if (this.isValidIndex(i)) {
                this.#slots.splice(i-1, 1);
                this.save();
                this.ensureAtLeastOneSlot();
                return true;
            } else {
                return false;
            }
        }
    
        renameSlotByIndex(newName) {
            const slot = this.data.getCurrentSlot();
            if (this.#slots.some(s => s.name === newName)) return false;
            const s = this.#slots.find(s => s.name === oldName);
            if (!s) return false;
            s.name = newName;
            this.save();

            this.ensureAtLeastOneSlot();
            return true;
        }
    
        save() {
            const text = StashData.serialize(this.#slots);
            StashData.saveSlotDataToStorage(text);
        }

        static saveSlotDataToStorage(text) {
            localStorage.setItem(StashData.STORAGE_KEY_SLOTS, text);
        }

        static loadSlotDataFromStorage() {
            const text = localStorage.getItem(StashData.STORAGE_KEY_SLOTS) || '';
            return text;
        }

        static loadSlotsFromStorage() {
            const text = this.loadSlotDataFromStorage();
            return this.deserialize(text);
        }

        static serialize(slots) {
            const lines = ['# version:1'];
            for (const slot of slots) {
                lines.push(`# slot:${slot.name}`);
                lines.push(`# type:${slot.type}`);
                for (const [regionId, items] of slot.entries()) {
                    for (const item of items) {
                        lines.push(JSON.stringify({
                            region: regionId,
                            itemId: item.itemId,
                            itemRefined: item.itemRefined,
                            cardIds: item.cardIds
                        }));
                    }
                }
            }
            return lines.join('\n');
        }

        static deserialize(raw) {
            const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const slots = [];
            let currentSlot = null;
            let currentType = 'stash';
    
            for (const line of lines) {
                if (line.startsWith('# version:')) {
                    const ver = parseInt(line.slice(10).trim(), 10);
                    if (Number.isNaN(ver) || ver !== 1) throw new Error('Unsupported version');
                    continue;
                }
                if (line.startsWith('# slot:')) {
                    const name = line.slice(7).trim() || 'スロット1';
                    currentSlot = new StashSlot(name, currentType);
                    slots.push(currentSlot);
                    continue;
                }
                if (line.startsWith('# type:')) {
                    currentType = line.slice(7).trim() || 'stash';
                    if (currentSlot) {
                        currentSlot.type = currentType;
                    }
                    continue;
                }
                if (!currentSlot) throw new Error(`スロット指定前にデータ行が存在します: ${line}`);
                const obj = JSON.parse(line);
                const item = new StashItem(obj.itemId, obj.itemRefined, obj.cardIds);
                currentSlot.addItem(obj.region, item);
            }
    
            return slots;
        }
    }    
    
	class StashEquipRow {
		constructor(regionId, def) {
			this.regionId = regionId;
			this.def = def;
		}

		extract() {
			return new StashItem(
				parseInt($('#' + this.def.itemSelectId).val() || 0, 10),
				this.def.refineSelectId ? parseInt($('#' + this.def.refineSelectId).val() || 0, 10) : 0,
				this.def.cardRegionIds.map(i => n_A_card[i])
			);
		}

		apply(item) {
			HtmlSetObjectValueById(this.def.itemSelectId, item.itemId);
			OnChangeEquip(this.regionId, item.itemId);
			if (this.def.refineSelectId) {
				HtmlSetObjectValueById(this.def.refineSelectId, item.itemRefined);
			}
			item.cardIds.forEach((cardId, i) => {
				if (cardId > 0) {
					HtmlSetObjectValueById(`${this.def.itemSelectId}_CARD_${i + 1}`, cardId);
					OnChangeCard(cardId);
				}
			});
		}
	}

	const StashEquipBinder = {
		regionMappings: new Map(),

		define(regionId, itemSelectId, refineSelectId, cardRegionIds) {
			this.regionMappings.set(regionId, {
				itemSelectId,
				refineSelectId,
				cardRegionIds
			});
		},

		fromRegionId(regionId) {
			const def = this.regionMappings.get(regionId);
			if (!def) throw new Error(`未定義のregionId: ${regionId}`);
			return new StashEquipRow(regionId, def);
		},

		getRegionLabel(regionId) {
			const labels = {
				[EQUIP_REGION_ID_ARMS]: '武器',
				[EQUIP_REGION_ID_ARMS_LEFT]: '左手',
				[EQUIP_REGION_ID_HEAD_TOP]: '頭上段',
				[EQUIP_REGION_ID_HEAD_MID]: '頭中段',
				[EQUIP_REGION_ID_HEAD_UNDER]: '頭下段',
				[EQUIP_REGION_ID_SHIELD]: '盾',
				[EQUIP_REGION_ID_BODY]: '鎧',
				[EQUIP_REGION_ID_SHOULDER]: '肩にかけるもの',
				[EQUIP_REGION_ID_SHOES]: '靴',
				[EQUIP_REGION_ID_ACCESSARY_1]: 'アクセサリ1',
				[EQUIP_REGION_ID_ACCESSARY_2]: 'アクセサリ2'
			};
			return labels[regionId] || `部位${regionId}`;
		}
	};

    class StashUI {
		constructor() {
			this.data = new StashData();
            this.$modal = $(StashUI.HTML_DIV_STASH).hide();
            $('body').append(this.$modal);

			this.$tabs = this.$modal.find('.stash-tabs');
			this.$slot = this.$modal.find('.stash-content');
            this.$editButton = this.$modal.find('.edit-data-button');
			this.$closeButton = this.$modal.find('.close-button');
            this.$stashAll = this.$modal.find('.stash-all-btn');
            this.$restoreAll = this.$modal.find('.restore-all-btn');

            this.$editModal = $(StashUI.HTML_DIV_STASH_EDIT_MODAL).hide();
            $('body').append(this.$editModal);

			this.bindEvents();
			this.bindAddButtons();
		}

		bindEvents() {
			this.$closeButton.click(() => this.hide());

			$(document).on('keydown', (e) => {
				if (e.altKey && e.key.toLowerCase() === 'e') {
					e.preventDefault();
					this.toggle();
				}
			});

			// 背景オーバーレイ（クリックで閉じる）
			this.$overlay = $('<div class="stash-modal-overlay"></div>').hide();
			$('body').append(this.$overlay);
			this.$overlay.on('click', () => this.hide());

            this.$stashAll.off('click').on('click', () => {
                const slot = this.data.getCurrentSlot();
                for (const [regionId] of StashEquipBinder.regionMappings.entries()) {
                    const row = StashEquipBinder.fromRegionId(regionId);
                    const item = row.extract();
                    if (item.itemId > 0) {
                        slot.addItem(regionId, item);
                    }
                }
                this.data.save();
                this.render();
                this.show();
            });
            
            this.$restoreAll.off('click').on('click', async () => {
                await this.restoreAllItems();
                this.hide();
            });

            // 直接編集を開始
            this.$editButton.click(() => {
                $('#STASH_EDIT_TEXTAREA').val(StashData.loadSlotDataFromStorage());
                this.$editModal.show();
            });
            this.$modal.find('.stash-controls').prepend(this.$editButton);

            $('#STASH_EDIT_SAVE').click(() => {
                const raw = $('#STASH_EDIT_TEXTAREA').val();
            
                try {
                    // バリデーション
                    const slots = StashData.deserialize(raw);

                    // 保存
                    const text = StashData.serialize(slots);
                    StashData.saveSlotDataToStorage(text);
            
                    // モデル更新
                    this.data = new StashData();

                    // ビュー更新
                    this.render();
            
                    // 編集モーダルのみ閉じる
                    $('#OBJID_STASH_EDIT_MODAL').hide();
                } catch (e) {
                    alert('保存失敗: ' + e.message);
                }
            });
            
            $('#STASH_EDIT_CANCEL').click(() => {
                $('#OBJID_STASH_EDIT_MODAL').hide();
            });
        }

        bindAddButtons() {
            // 履歴選択モーダルを作成
            this.$historyModal = $(StashUI.HTML_DIV_STASH_HISTORY_MODAL).hide();
            $('body').append(this.$historyModal);
            this.$historyModal.find('.stash-history-close').on('click', () => this.$historyModal.hide());
            $(document).on('click', (e) => {
                if (this.$historyModal.is(':visible') && !$(e.target).closest('.stash-history-modal, .CSSCLS_STASH_HISTORY_BUTTON').length) {
                    this.$historyModal.hide();
                }
            });

            for (const [regionId, def] of StashEquipBinder.regionMappings.entries()) {
                const $elem = $('#' + def.itemSelectId);
                if ($elem.length === 0 || $elem.css('visibility') === 'hidden') continue;

                const $container = $('<div style="position: relative;"></div>');

                // 履歴ボタン
                const $historyBtn = $('<span class="CSSCLS_STASH_HISTORY_BUTTON" title="履歴から選択">履歴</span>');
                $historyBtn.data('regionId', regionId);
                $historyBtn.click((e) => {
                    e.stopPropagation();
                    this.showHistoryModal(regionId, $historyBtn);
                });

                // 追加ボタン
                const $btn = $('<span class="CSSCLS_STASH_COPY_BUTTON" title="Stashに追加">➕</span>');
                $btn.data('regionId', regionId);
                $btn.click((e) => {
                    e.stopPropagation();
                    const binder = StashEquipBinder.fromRegionId(regionId);
                    const item = binder.extract();
                    if (item.itemId > 0) {
                        const slot = this.data.getCurrentSlot();
                        slot.addItem(regionId, item);
                        this.data.save();
                        this.render();
                        this.show();
                    }
                });

                $elem.wrap($container);
                $elem.parent().append($historyBtn, $btn);
            }

            const $toggle = $('#OBJID_STASH_CURRENT_SLOT').off('click').empty().on('click', e => this.toggle());
            this.updateCurrentSlotLabel();
        }

        showHistoryModal(regionId, $anchor) {
            const slot = this.data.getCurrentSlot();
            const items = slot.regionMap.get(regionId) || [];
            const $list = this.$historyModal.find('.stash-history-list').empty();

            if (items.length === 0) {
                $list.append('<div class="stash-history-empty">履歴がありません</div>');
            } else {
                for (const item of items) {
                    const $item = $('<div class="stash-history-item"></div>')
                        .text(item.toDisplayString(',', false))
                        .on('click', () => {
                            this.restoreItem(regionId, item);
                            this.$historyModal.hide();
                        });
                    $list.append($item);
                }
            }

            // モーダルの位置を調整
            const offset = $anchor.offset();
            this.$historyModal.css({
                top: offset.top + $anchor.outerHeight() + 5,
                left: Math.min(offset.left, $(window).width() - this.$historyModal.outerWidth() - 10)
            }).show();
        }
 
        updateCurrentSlotLabel() {
            const slot = this.data.getCurrentSlot();
            const emojis = {
                stash: '📁',
                preset: '💾'
            };
            const emoji = emojis[slot.type] || '📁';
            const label = StashSlot.getTypeLabel(slot.type) || slot.type;
            $('#OBJID_STASH_CURRENT_SLOT').text(`${emoji}${label}: ${slot.name}`);
            this.$modal
                .removeClass('type-stash type-preset')
                .addClass(`type-${slot.type}`);
        }
                        
        getCurrentSlot() {
            return this.data.getCurrentSlot();
        }
        
		addItem(regionId, item) {
			const index = this.currentSlotIndex;
			this.data.addItemToSlot(index, regionId, item);
			this.render();
			this.show();
		}

		removeItem(regionId, item) {
            this.getCurrentSlot().removeItem(regionId, item);
            this.data.save();
			this.render();
		}

        async restoreItem(regionId, item, { skipPostProcess = false } = {}) {
            const $btn = this.$slot.find('.item-button').filter((_, el) => {
                    const val = $(el).data('value');
                    return val && item.equals(val);
            });
    
            $btn.addClass('restoring');
            await new Promise(r => setTimeout(r, 100));
    
			const row = StashEquipBinder.fromRegionId(regionId);
            row.apply(item);
    
            $btn.removeClass('restoring');
    
            if (!skipPostProcess) {
                    StAllCalc();
                    LoadSelect2();
		    calc();
            }
        }

        async restoreAllItems() {
            const slot = this.getCurrentSlot();
            const $btnMap = new Map();
            this.$slot.find('.item-button').each((_, el) => {
                const val = $(el).data('value');
                if (val?.key) $btnMap.set(val.key, $(el));
            });
            for (const [regionId, list] of slot.entries()) {
                if (list.length > 0) {
                    const item = list[0];
                    const $btn = $btnMap.get(item.key);
                    if ($btn) $btn.addClass('restoring');
                    await new Promise(r => setTimeout(r, 10));
                    const row = StashEquipBinder.fromRegionId(regionId);
                    row.apply(item);
                    if ($btn) $btn.removeClass('restoring');
                }
            }
            StAllCalc();
            AutoCalc();
            LoadSelect2();
        }

        static HTML_DIV_STASH_EDIT_MODAL = `
            <div id="OBJID_STASH_EDIT_MODAL" class="modal">
                <div>保存データ (JSON)</div>
                <textarea id="STASH_EDIT_TEXTAREA"></textarea>
                <div class="edit-buttons">
                    <button type="button" id="STASH_EDIT_SAVE">保存</button>
                    <button type="button" id="STASH_EDIT_CANCEL">キャンセル</button>
                </div>
            </div>
        `;

        static HTML_DIV_STASH_HISTORY_MODAL = `
            <div class="stash-history-modal">
                <div class="stash-history-list"></div>
            </div>
        `;

        static HTML_DIV_STASH = `
            <div id="OBJID_DIV_STASH">
                <div class="stash-header">
                    <div class="stash-tabs"></div>
                    <div class="stash-controls">
                        <button type="button" class="edit-data-button edit-data-toggle-off">直接編集</button>
                        <button type="button" class="close-button">閉じる</button>
                    </div>
                </div>
                <div class="stash-content"></div>
                <div class="stash-footer">
                    <button type="button" class="stash-all-btn">↑ 一括保存</button>
                    <button type="button" class="restore-all-btn">↓ 一括装備</button>
                </div>
            </div>
        `;

        /**
         * $modal(#OBJID_DIV_STASH)
         * +------------------------------+ (.stash-header)
         * | [履歴1] [保存枠2] [＋]       |   ← タブ領域（renderTabs） (.stash-tabs)
         * +------------------------------+ $slot(.stash-content)
         * | (〇) 履歴   ( ) 保存枠       |   ← スロット種別ラジオ（.slot-type-selector）
         * | ▼ 武器                       |   (.slot-region-maps)
         * |  +10 プロキオンダガー ✖      |    └ アイテムと削除ボタン（item-button + item-delete-button）
         * +------------------------------+ (.stash-footer)
         * | [一括保存] [一括装備]        |  ← 一括処理ボタン (.stash-content-footer) 
         * +------------------------------+
         */
        render() {
            this.renderTabs();
            this.$slot.empty();

            // スロット種別ラジオ（.slot-type-selector）
            const $contentHeader = $('<div class="slot-type-selector">');
            const currentSlot = this.data.getCurrentSlot();

            for (const [type, label] of StashSlot.TYPES) {
                const $label = $('<label>').css({ marginRight: '12px' });
                const $radio = $('<input type="radio" name="slot-type">')
                    .val(type)
                    .prop('checked', type === currentSlot.type)
                    .on('change', () => {
                        currentSlot.setType(type);
                        this.data.save();
                        this.$modal.removeClass('type-preset type-stash').addClass(`type-${type}`);
                        this.render();
                        this.updateCurrentSlotLabel();
                    });
                $label.append($radio, ` ${label}`);
                $contentHeader.append($label);
            }
            this.$slot.append($contentHeader);

            // 各装備部位グループ（.slot-region-maps）
            switch (currentSlot.type) {
                case 'stash':
                    this.renderStashTable(this.$slot, currentSlot);
                    break;
                case 'preset':
                    const jobId = $('#OBJID_SELECT_JOB').val();
                    const $image = RagnarokImageData.getImageByJobId(jobId);
                    this.renderPresetTable(this.$slot, currentSlot, $image);
                    break;
            }
        }

        renderTabs() {
            this.$tabs.empty();
            const slots = this.data.getSlots();
            const slotIndex = this.data.getCurrentSlotIndex();
            for (let i = 0; i < slots.length; i++) {
                const slot = slots[i];
                const $tab = $('<div>')
                    .addClass(`stash-tab in-modal type-${slot.type}`)
                    .attr('tabindex', 0)
                    .toggleClass('active', slotIndex === i + 1)
                    .text(slot.name);
        
                $tab.on('click', () => {
                    if (slotIndex !== i + 1) {
                        this.data.setCurrentSlotIndex(i + 1, 'ユーザのタブ選択');
                        this.render();
                        this.updateCurrentSlotLabel();
                    } else {
                        startEditing();
                    }
                });
                $tab.on('keydown', (e) => {
                    if (e.key === 'Enter') startEditing();
                });
                const startEditing = () => {
                    const $input = $('<input type="text">')
                        .val(slot.name)
                        .addClass('stash-tab-edit')
                        .css({ minWidth: '80px' });
                    $tab.replaceWith($input);
                    $input.focus().select();
                    $input.on('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            const newName = $input.val().trim();
                            if (newName && newName !== slot.name) {
                                slot.setName(newName);
                                this.data.save();
                                this.render();
                                this.updateCurrentSlotLabel();
                                return;
                            }
                            this.render();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            this.render();
                        }
                    });
                    $input.on('blur', () => this.render());
                };
        
                $tab.on('contextmenu', (e) => {
                    e.preventDefault();
                    if (confirm(`スロット(${slot.name})を削除しますか？`)) {
                        if (this.data.deleteSlotByIndex(i + 1)) {
                            this.data.ensureValidIndex(`スロット(${slot.name}削除後)`);
                            this.render();
                        }
                    }
                });
        
                this.$tabs.append($tab);
            }
        
            const $add = $('<div>')
                .addClass('stash-tab add-tab in-modal')
                .text('＋')
                .click(() => {
                    const base = '新規スロット';
                    let name = base, i = 1;
                    const exists = this.data.getSlots().map(s => s.name);
                    while (exists.includes(name)) name = `${base}${++i}`;
                    if (this.data.createSlot(name, 'stash')) {
                        this.data.setCurrentSlotIndex(this.data.counts(), '新規スロット作成');
                        this.render();
                    }
                });
            this.$tabs.append($add);
        }

        renderStashTable($container, slot) {
            const $regionMaps = $('<div class="slot-region-maps">');

            for (const [regionId, list] of [...slot.entries()].sort((a, b) => a[0] - b[0])) {
                const $group = $('<div>').addClass('item-group');
                const label = StashEquipBinder.getRegionLabel(regionId);
                $group.append($('<div>').addClass('item-group-title').text(`▼ ${label}`));

                const $body = $('<div>').addClass('item-group-body');
                for (const item of list) {
                    const $btn = $('<span>').addClass('item-button').text(item.toDisplayString(',', false)).data('value', item);
                    const $del = $('<span>').addClass('item-delete-button in-modal').text('✖');
                    $del.off('click').on('click', () => this.removeItem(regionId, item));
                    $btn.off('click').on('click', () => this.restoreItem(regionId, item));
                    $body.append($('<div>').addClass('item-wrapper').append($btn, $del));
                }
                $group.append($body);
                $regionMaps.append($group);
            }
            $container.append($regionMaps);
        }


        renderPresetTable($container, slot, $image) {
            const regionLayout = [
                [2,     3],
                [4,     6],
                [0,     [1,5]],
                [7,     8],
                [9,     10]
            ];
            const table = $('<table>').addClass('preset-table');
        
            table.append(
                $('<colgroup>')
                    .append('<col style="width:40%">')
                    .append('<col style="width:20%">')
                    .append('<col style="width:40%">')
            );

            const regionMap = new Map(slot.entries());
        
            const buildCell = (spec, className) => {
                const ids = spec == null ? [] : (Array.isArray(spec) ? spec : [spec]);
                const $td = $('<td>').addClass(className);
                const $container = $('<div>').addClass('cell-container');
                let rendered = false;
        
                for (const regionId of ids) {
                    const itemList = regionMap.get(regionId);
                    const item = itemList?.[itemList.length - 1];
                    if (item && !rendered) {
                        const displayHtml = item.toDisplayString('\n', true)
                            .split('\n')
                            .map(line => {
                                return line.replace(/#x(\d+)/g, (match, p1) => {
                                    return `<span class="card-meta">x${p1}</span>`;
                                });
                            })
                            .map(line => $('<span>').html(line).prop('outerHTML'))
                            .join('<br>');
                        const $btn = $('<div>')
                            .addClass('item-button')
                            .html(displayHtml)
                            .data('value', item)
                            .off('click')
                            .on('click', () => this.restoreItem(regionId, item));
                        const $del = $('<span>')
                            .addClass('item-delete-button in-modal')
                            .text('✖')
                            .off('click')
                            .on('click', () => this.removeItem(regionId, item));
                        const $wrap = $('<div>').addClass('preset-item-wrapper').append($btn, $del);
                        $container.append($wrap);
                        rendered = true;
                    }
                }
        
                if (!rendered) {
                    $container.append('<div class="preset-item-wrapper item-placeholder">&nbsp;</div>');
                }
        
                return $td.append($container);
            };
        
            const buildImageCell = () => {
                const $td = $('<td>')
                    .addClass('cell-image')
                    .attr('rowspan', regionLayout.length);
        
                if ($image) {
                    $td.append($image);
                }
                return $td;
            };
        
            for (let row = 0; row < regionLayout.length; row++) {
                const [leftSpec, rightSpec] = regionLayout[row];
                const tr = $('<tr>');
                tr.append(buildCell(leftSpec, 'cell-left'));
        
                if (row === 0) {
                    tr.append(buildImageCell());
                }
        
                tr.append(buildCell(rightSpec, 'cell-right'));
                table.append(tr);
            }
        
            $container.append(table);
        }

        show() {
            this.render();
            this.$overlay.show();
            this.$modal.show();
            this.updateCurrentSlotLabel();
        }
		hide() { this.$modal.hide(); this.$overlay.hide(); this.updateCurrentSlotLabel();}
		toggle() { this.$modal.is(':visible') ? this.hide() : this.show(); }
	}


    /* https://ragnarokonline.gungho.jp/gameguide/character/ */
    class RagnarokImageData {
        static #data = {};
    
        static {
            this.#data[MIG_JOB_ID_NOVICE] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/novice.png', crop_area: { x1: 0, y1: 0, x2: null, y2: null } };
            this.#data[MIG_JOB_ID_SWORDMAN] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/swordman/swordman.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_THIEF] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/thief/thief.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_ACOLYTE] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/acolyte/acolyte.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_ARCHER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/archer.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_MAGICIAN] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/magician/magician.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_MARCHANT] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/merchant/merchant.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_KNIGHT] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/swordman/knight.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_ASSASIN] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/thief/assassin.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_PRIEST] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/acolyte/priest.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_HUNTER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/hunter.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_WIZARD] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/magician/wizard.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_BLACKSMITH] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/merchant/blacksmith.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_CRUSADER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/swordman/crusader.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_ROGUE] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/thief/rogue.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_MONK] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/acolyte/monk.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_BARD] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/bard.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_DANCER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/dancer.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SAGE] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/magician/sage.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_ALCHEMIST] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/merchant/alchemist.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SUPERNOVICE] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/novice/supernovice.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_LORDKNIGHT] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/swordman/lord_knight.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_ASSASINCROSS] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/thief/assassin_cross.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_HIGHPRIEST] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/acolyte/high_priest.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SNIPER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/sniper.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_HIGHWIZARD] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/magician/high_wizard.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_WHITESMITH] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/merchant/whitesmith.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_PALADIN] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/swordman/paladin.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_CHASER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/thief/chaser.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_CHAMPION] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/acolyte/champion.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_CROWN] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/clown.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_ZYPSY] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/gypsy.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_PROFESSOR] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/magician/professor.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_CREATOR] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/merchant/creator.png', crop_area: { x1: 0, y1: 0, x2: 78, y2: 78 } };
            this.#data[MIG_JOB_ID_TAEGWON] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/taekwon-kid/taekwon_kid.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_NINJA] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/ninja/ninja.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_GUNSLINGER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/gunslinger/gunslinger.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_RUNEKNIGHT] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/swordman/runeknight.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_ARCBISHOP] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/acolyte/archbishop.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_RANGER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/ranger.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_WARLOCK] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/magician/warlock.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_MECHANIC] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/merchant/mechanic.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_ROYALGUARD] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/swordman/royalguard.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SHADOWCHASER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/thief/shadowchaser.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SHURA] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/acolyte/sura.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_MINSTREL] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/minstrel.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_WANDERER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/wanderer.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SORCERER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/magician/sorcerer.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_GENETIC] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/merchant/genetic.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_KAGERO] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/ninja/kagerou.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_OBORO] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/ninja/oboro.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_REBELLION] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/gunslinger/rebellion.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SUMMONER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/summoner/summoner.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_STAR_EMPEROR] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/taekwon-kid/staremperor.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_DRAGON_KNIGHT] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/swordman/dragonknight.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SHADOW_CROSS] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/thief/shadowcross.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_CARDINAL] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/acolyte/cardinal.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_WIND_HAWK] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/windhawk.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_ARCH_MAGE] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/magician/archmage.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_MEISTER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/merchant/meister.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_ABYSS_CHASER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/thief/abysschaser.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_INQUISITOR] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/acolyte/inquisitor.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_TROUBADOUR] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/troubadour.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_TROUVERE] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/archer/trouvere.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_BIOLO] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/merchant/biolo.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SKY_EMPEROR] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/taekwon-kid/skyemperor.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SOUL_ASCETIC] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/taekwon-kid/soulascetic.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SHINKIROU] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/ninja/shinkiro.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SHIRANUI] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/ninja/shiranui.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_NIGHT_WATCH] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/gunslinger/nightwatch.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_HYPER_NOVICE] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/novice/hypernovice.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
            this.#data[MIG_JOB_ID_SPIRIT_HANDLER] = { image_url: 'https://ragnarokonline.gungho.jp/gameguide/character/images/job/new/summoner/spirithandler.png', crop_area: { x1: 0, y1: 0, x2:  78, y2: 78 } };
        }
    
        static getImageByJobId(jobId) {
            const d = this.#data[jobId] ?? null;
            if (!d?.image_url) return null;
        
            const $w = $('<div>').addClass('crop-box');
            const i = new Image();
            i.onload = () => {
                const { naturalWidth: iw, naturalHeight: ih } = i;
                const x1 = d.crop_area?.x1 ?? 0, y1 = d.crop_area?.y1 ?? 0;
                const x2 = d.crop_area?.x2 ?? iw, y2 = d.crop_area?.y2 ?? ih;
                const cw = x2 - x1, ch = y2 - y1;
        
                $w.css({
                    backgroundImage: `url(${d.image_url})`,
                    backgroundSize: `${(iw / cw) * 100}% ${(ih / ch) * 100}%`,
                    backgroundPosition: `${(-x1 / cw) * 100}% ${(-y1 / ch) * 100}%`,
                    backgroundRepeat: 'no-repeat',
                    width: '100%',
                    aspectRatio: cw / ch
                });
            };
            i.src = d.image_url;
            return $w;
        }
    }
    
	// === 定義適用 ===
	const defs = [
		[EQUIP_REGION_ID_ARMS, 'OBJID_ARMS_RIGHT', 'OBJID_ARMS_RIGHT_REFINE', [CARD_REGION_ID_ARMS_RIGHT_1, CARD_REGION_ID_ARMS_RIGHT_2, CARD_REGION_ID_ARMS_RIGHT_3, CARD_REGION_ID_ARMS_RIGHT_4]],
		[EQUIP_REGION_ID_ARMS_LEFT, 'OBJID_ARMS_LEFT', 'OBJID_ARMS_LEFT_REFINE', [CARD_REGION_ID_ARMS_LEFT_1, CARD_REGION_ID_ARMS_LEFT_2, CARD_REGION_ID_ARMS_LEFT_3, CARD_REGION_ID_ARMS_LEFT_4]],
		[EQUIP_REGION_ID_HEAD_TOP, 'OBJID_HEAD_TOP', 'OBJID_HEAD_TOP_REFINE', [CARD_REGION_ID_HEAD_TOP, CARD_REGION_ID_ENCHANT_HEAD_TOP_1, CARD_REGION_ID_ENCHANT_HEAD_TOP_2, CARD_REGION_ID_ENCHANT_HEAD_TOP_3]],
		[EQUIP_REGION_ID_HEAD_MID, 'OBJID_HEAD_MID', null, [CARD_REGION_ID_HEAD_MID, CARD_REGION_ID_ENCHANT_HEAD_MID_1, CARD_REGION_ID_ENCHANT_HEAD_MID_2, CARD_REGION_ID_ENCHANT_HEAD_MID_3]],
		[EQUIP_REGION_ID_HEAD_UNDER, 'OBJID_HEAD_UNDER', null, [-1, CARD_REGION_ID_ENCHANT_HEAD_UNDER_1, CARD_REGION_ID_ENCHANT_HEAD_UNDER_2, CARD_REGION_ID_ENCHANT_HEAD_UNDER_3]],
		[EQUIP_REGION_ID_SHIELD, 'OBJID_SHIELD', 'OBJID_SHIELD_REFINE', [CARD_REGION_ID_SHIELD, CARD_REGION_ID_ENCHANT_SHIELD_1, CARD_REGION_ID_ENCHANT_SHIELD_2, CARD_REGION_ID_ENCHANT_SHIELD_3]],
		[EQUIP_REGION_ID_BODY, 'OBJID_BODY', 'OBJID_BODY_REFINE', [CARD_REGION_ID_BODY, CARD_REGION_ID_ENCHANT_BODY_1, CARD_REGION_ID_ENCHANT_BODY_2, CARD_REGION_ID_ENCHANT_BODY_3]],
		[EQUIP_REGION_ID_SHOULDER, 'OBJID_SHOULDER', 'OBJID_SHOULDER_REFINE', [CARD_REGION_ID_SHOULDER, CARD_REGION_ID_ENCHANT_SHOULDER_1, CARD_REGION_ID_ENCHANT_SHOULDER_2, CARD_REGION_ID_ENCHANT_SHOULDER_3]],
		[EQUIP_REGION_ID_SHOES, 'OBJID_SHOES', 'OBJID_SHOES_REFINE', [CARD_REGION_ID_SHOES, CARD_REGION_ID_ENCHANT_SHOES_1, CARD_REGION_ID_ENCHANT_SHOES_2, CARD_REGION_ID_ENCHANT_SHOES_3]],
		[EQUIP_REGION_ID_ACCESSARY_1, 'OBJID_ACCESSARY_1', null, [CARD_REGION_ID_ACCESSARY_1, CARD_REGION_ID_ENCHANT_ACCESSARY_1_1, CARD_REGION_ID_ENCHANT_ACCESSARY_1_2, CARD_REGION_ID_ENCHANT_ACCESSARY_1_3]],
		[EQUIP_REGION_ID_ACCESSARY_2, 'OBJID_ACCESSARY_2', null, [CARD_REGION_ID_ACCESSARY_2, CARD_REGION_ID_ENCHANT_ACCESSARY_2_1, CARD_REGION_ID_ENCHANT_ACCESSARY_2_2, CARD_REGION_ID_ENCHANT_ACCESSARY_2_3]]
	];
	for (const [a, b, c, d] of defs) StashEquipBinder.define(a, b, c, d);

	window.StashEquipBinder = StashEquipBinder;
	window.StashUI = new StashUI();
});
