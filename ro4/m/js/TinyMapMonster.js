/**
 * マップモンスター簡易情報
 */
class TinyMapMonster {
	// key: mapId, value: damageDivisor (1/value)
	static MAP_DAMAGE_DIVISOR_BY_MAP_ID = {
		442: 5,  // "幻影の迷宮（幻影ルート）"
		452: 5,  // "星座の塔"
		481: 10, // "ファロス燈台(ハード)"
		483: 10, // "ネバーエンドレスタワー"
		//(IDなし)	20, // エンドレスタワーアナザー（みなごろし）
	};

	static TOUGHNESS_CODE_TO_DIVISOR = new Map([
		[MonsterToughness.DAMPING_5, 5],
		[MonsterToughness.DAMPING_10, 10],
		[MonsterToughness.DAMPING_100, 100],
		[MonsterToughness.DAMPING_1000, 1000],
	]);

	// [モンスター状態強化設定]の[ダメージ減衰]で設定されている減衰値(1/n)
	// see: head.js:dmgDivArray
	static DAMAGE_DIVISOR_OPTIONS = [
		1, 2, 5,
		10, 20, 50,
		100, 200, 500,
		1000
	];

	// ===== Repo (生データ参照を隔離) =====
	static Repo = {
		getCurrentMapId() {
			return CMonsterMapAreaComponentManager.GetMapId();
		},

		getCurrentMonsterId() {
			return CMonsterMapAreaComponentManager.GetMonsterId();
		},

		getMapData(mapId) {
			return g_MonsterMapDataArray?.[mapId] ?? null;
		},

		getMapKind(mapId) {
			return this.getMapData(mapId)?.[MONSTER_MAP_DATA_INDEX_KIND];
		},

		getMapIdFromMapData(mapData) {
			return mapData?.[MONSTER_MAP_DATA_INDEX_ID] ?? null;
		},

		getMapName(mapId) {
			return this.getMapData(mapId)?.[MONSTER_MAP_DATA_INDEX_NAME_KANA_ARRAY]?.[0]?.[0] ?? `map:${mapId}`;
		},

		getMapMonsterIds(mapId) {
			return this.getMapData(mapId)?.[MONSTER_MAP_DATA_INDEX_DATA_ARRAY] ?? null;
		},

		getCategoryData(categoryId) {
			return g_MonsterMapCategoryDataArray?.[categoryId] ?? null;
		},

		getCategoryName(categoryId) {
			return this.getCategoryData(categoryId)?.[MONSTER_MAP_DATA_INDEX_NAME_KANA_ARRAY]?.[0]?.[0] ?? "";
		},

		getCategoryMapIds(categoryId) {
			return this.getCategoryData(categoryId)?.[MONSTER_MAP_DATA_INDEX_DATA_ARRAY] ?? null;
		},

		getMonsterName(monsterId) {
			return MonsterObjNew?.[monsterId]?.[MONSTER_DATA_INDEX_NAME] ?? `mob:${monsterId}`;
		},

		// monster が属する最初のマップIDを返す（見つからなければ null）
		findMapIdForMonster(monsterId) {
			if (monsterId == null) return null;
			for (let idx = 0; idx < g_MonsterMapDataArray.length; idx++) {
				const mapData = g_MonsterMapDataArray[idx];
				if (!mapData) continue;
				if (mapData[MONSTER_MAP_DATA_INDEX_KIND] === MONSTER_MAP_KIND_CATEGORY) continue;
				const monsterIdArray = mapData[MONSTER_MAP_DATA_INDEX_DATA_ARRAY];
				if (monsterIdArray?.includes(monsterId)) {
					return mapData[MONSTER_MAP_DATA_INDEX_ID];
				}
			}
			return null;
		},

		// 表示用のマップID。選択中のマップが「全マップ」のときは monster から推定する
		getEffectiveMapId(monsterId) {
			const mapId = this.getCurrentMapId();
			if (mapId !== MONSTER_MAP_ID_MAP_ALL) return mapId;
			return this.findMapIdForMonster(monsterId) ?? mapId;
		},
	};

	// ===== UI (共通UI部品棚) =====
	static UI = {
		createModalOverlay({ id, onOuterClickClose }) {
			return $("<div>", {
				id,
				css: {
					position: "fixed",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					backgroundColor: "rgba(0,0,0,0.5)",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					zIndex: 10000,
				},
				click: (e) => {
					if (e.target === e.currentTarget) onOuterClickClose?.();
				},
			});
		},

		createModalContent({ id }) {
			return $("<div>", {
				id,
				css: {
					backgroundColor: "white",
					padding: "10px",
					borderRadius: "5px",
					width: "90%",
					height: "90%",
					display: "flex",
					flexDirection: "column",
				},
			});
		},

		createHeader(leftNode, rightNode) {
			const header = $("<div>", {
				css: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "8px",
				},
			});
			header.append(leftNode, rightNode);
			return header;
		},

		createBreadcrumb(parts) {
			const wrap = $("<div>", {
				css: {
					fontSize: "12px",
					color: "#666",
				},
			});
			parts.forEach((p, i) => {
				if (i > 0) wrap.append($("<span>").text(" > ").css("margin", "0 4px"));
				wrap.append(p);
			});
			return wrap;
		},

		createSearchBox({ placeholder, value, onChange }) {
			let isComposing = false;
			return $("<input>", {
				type: "text",
				placeholder,
				val: value ?? "",
				css: {
					padding: "3px 6px",
					fontSize: "12px",
					border: "1px solid #ccc",
					borderRadius: "3px",
					width: "150px",
				},
			}).on("compositionstart", () => {
				isComposing = true;
			}).on("compositionend", (e) => {
				isComposing = false;
				onChange?.(e.target.value);
			}).on("input", (e) => {
				if (!isComposing) onChange?.(e.target.value);
			});
		},

		highlight(text, query) {
			if (!query) return $("<span>").text(text);

			const lowerText = String(text).toLowerCase();
			const lowerQuery = String(query).toLowerCase();
			const idx = lowerText.indexOf(lowerQuery);
			if (idx === -1) return $("<span>").text(text);

			const before = String(text).substring(0, idx);
			const match = String(text).substring(idx, idx + String(query).length);
			const after = String(text).substring(idx + String(query).length);

			return $("<span>").append(
				document.createTextNode(before),
				$("<mark>", { css: { backgroundColor: "#FFEB3B", padding: 0 } }).text(match),
				document.createTextNode(after)
			);
		},

		measureMaxWidth(texts, styleCss = {}) {
			const measureSpan = $("<span>", {
				css: {
					visibility: "hidden",
					position: "absolute",
					whiteSpace: "nowrap",
					...styleCss,
				},
			});
			$("body").append(measureSpan);

			let maxWidth = 0;
			texts.forEach((t) => {
				measureSpan.text(t);
				maxWidth = Math.max(maxWidth, measureSpan.outerWidth());
			});

			measureSpan.remove();
			return maxWidth;
		},

		renderButtonGrid({ container, items, getText, isSelected, onClick, query, highlight, buttonCssBase, buttonCssSelected }) {
			if (!items || items.length === 0) return;

			const texts = items.map((it) => getText(it));
			const maxWidth = this.measureMaxWidth(texts, {
				padding: (buttonCssBase?.padding ?? "5px 10px"),
				fontSize: buttonCssBase?.fontSize,
			});

			items.forEach((it) => {
				const selected = !!isSelected?.(it);
				const text = getText(it);

				const btn = $("<button>", {
					type: "button",
					css: {
						...buttonCssBase,
						...(selected ? buttonCssSelected : null),
						width: maxWidth + "px",
						boxSizing: "border-box",
						whiteSpace: "nowrap",
						textAlign: "center",
					},
					click: () => onClick?.(it),
				});

				if (query && highlight) {
					btn.append(this.highlight(text, query));
				} else {
					btn.text(text);
				}

				container.append(btn);
			});
		},

		focusSearchBox(modalRoot, searchQuery) {
			const input = modalRoot.find("input");
			input.focus();
			if (searchQuery) {
				input[0].setSelectionRange(searchQuery.length, searchQuery.length);
			}
		},
	};

	// ===== Damage (ダメージ減衰の算出・反映) =====
	static Damage = {
		getCurrentMapDivisor() {
			const mapId = TinyMapMonster.Repo.getCurrentMapId();
			return TinyMapMonster.MAP_DAMAGE_DIVISOR_BY_MAP_ID[mapId] ?? 1;
		},

		getMobDivisor(mobName) {
			const code = MonsterToughness.getToughnessCode(mobName) ?? MonsterToughness.DAMPING_NONE;

			const dampingCode = code & (
				MonsterToughness.DAMPING_5 |
				MonsterToughness.DAMPING_10 |
				MonsterToughness.DAMPING_100 |
				MonsterToughness.DAMPING_1000
			);

			return TinyMapMonster.TOUGHNESS_CODE_TO_DIVISOR.get(dampingCode) ?? 1;
		},

		getSelectedDivisor() {
			return TinyMapMonster.DAMAGE_DIVISOR_OPTIONS[n_B_KYOUKA[MOB_CONF_BUF_ID_DAMAGE_DIVIDE]] ?? 1;
		},

		getMobNotification(mobName) {
			const code = MonsterToughness.getToughnessCode(mobName);
			return MonsterToughness.getNotification(code);
		},

		runWithMobConfBufTabOpened(fn) {
			if (!fn) return;

			const el = document.getElementById("OBJID_INPUT_MOB_CONF_BUF_SWITCH");
			if (!el) {
				fn();
				return;
			}

			const wasClosed = !el.checked;
			if (wasClosed) el.click();

			try {
				fn();
			} finally {
				if (wasClosed) el.click();
			}
		},

		getMobConfBufDamageDivideSelect() {
			const rowIdx = 0; // [モンスター状態強化設定]の上から1列目(idx=0)
			const confId = MobConfBufOBJ[rowIdx][MOB_CONF_BUF_DATA_INDEX_ID];
			return $(`#OBJID_SELECT_MOB_CONF_BUF_${confId}`);
		},

		setDamageDivideByDivisor(divisor) {
			const idx = TinyMapMonster.DAMAGE_DIVISOR_OPTIONS.indexOf(divisor);
			const value = (idx >= 0) ? idx : 0;
			this.getMobConfBufDamageDivideSelect().val(value).trigger("change");
		},

		prettyDiv(div) {
			return (div === 1 ? "等倍" : `1/${div}`);
		},
	};

	// ===== Map Modal =====
	static MapModal = {
		modalId: "TinyMapMonster-map-modal",
		contentId: "TinyMapMonster-map-modal-content",
		state: {
			selectedCategoryId: null,
			query: "",
		},

		open() {
			this.close();

			const currentCategoryId = this.getCategoryIdForCurrentMap();
			this.state.selectedCategoryId = currentCategoryId;
			this.state.query = "";

			const overlay = TinyMapMonster.UI.createModalOverlay({
				id: this.modalId,
				onOuterClickClose: () => this.close(),
			});
			const content = TinyMapMonster.UI.createModalContent({ id: this.contentId });

			overlay.append(content);
			$("body").append(overlay);

			this.render();
		},

		close() {
			$(`#${this.modalId}`).remove();
		},

		getContent() {
			return $(`#${this.contentId}`);
		},

		getCategoryList() {
			const categories = [];
			for (let categoryId = 0; categoryId < g_MonsterMapCategoryDataArray.length; categoryId++) {
				if (categoryId === MONSTER_MAP_ID_CATEGORY_ALL) continue;
				const name = TinyMapMonster.Repo.getCategoryName(categoryId);
				if (!name) continue;
				categories.push({ id: categoryId, name });
			}
			return categories;
		},

		getMapListForCategory(categoryId) {
			const categoryData = TinyMapMonster.Repo.getCategoryData(categoryId);
			if (!categoryData) return [];

			// メモリアルダンジョン地域の場合は、全マップからKINDでフィルタリング
			if (categoryId === MONSTER_MAP_ID_CATEGORY_MEMORIAL_DUNGEON) {
				const maps = [];
				for (let idx = 0; idx < g_MonsterMapDataArray.length; idx++) {
					const mapData = g_MonsterMapDataArray[idx];
					if (!mapData) continue;
					if (mapData[MONSTER_MAP_DATA_INDEX_KIND] === MONSTER_MAP_KIND_MEMORIAL_DUNGEON) {
						const mapId = mapData[MONSTER_MAP_DATA_INDEX_ID];
						maps.push({
							id: mapId,
							name: TinyMapMonster.Repo.getMapName(mapId),
						});
					}
				}
				return maps;
			}

			// 通常の地域はDATA_ARRAYからマップIDを取得
			const mapIdArray = TinyMapMonster.Repo.getCategoryMapIds(categoryId);
			if (!mapIdArray || mapIdArray.length === 0) return [];

			return mapIdArray.map((mapId) => ({
				id: mapId,
				name: TinyMapMonster.Repo.getMapName(mapId),
			}));
		},

		getCategoryIdForMapId(mapId) {
			const kind = TinyMapMonster.Repo.getMapKind(mapId);
			if (kind === MONSTER_MAP_KIND_MEMORIAL_DUNGEON) {
				return MONSTER_MAP_ID_CATEGORY_MEMORIAL_DUNGEON;
			}
			for (let categoryId = 2; categoryId < g_MonsterMapCategoryDataArray.length; categoryId++) {
				const mapIdArray = TinyMapMonster.Repo.getCategoryMapIds(categoryId);
				if (mapIdArray?.includes(mapId)) {
					return categoryId;
				}
			}
			return MONSTER_MAP_ID_CATEGORY_ALL;
		},

		getCategoryIdForCurrentMap() {
			const selectCategoryId = parseInt($(".OBJID_MONSTER_MAP_CATEGORY").val(), 10);

			// 「全地域」以外が選択されている場合はそのまま返す
			if (selectCategoryId !== MONSTER_MAP_ID_CATEGORY_ALL) {
				return selectCategoryId;
			}

			// 「全地域」の場合、選択中モンスターから推定したマップIDのカテゴリを判定
			const monsterId = TinyMapMonster.Repo.getCurrentMonsterId();
			const mapId = TinyMapMonster.Repo.getEffectiveMapId(monsterId);
			if (mapId === MONSTER_MAP_ID_MAP_ALL) {
				return selectCategoryId;
			}
			return this.getCategoryIdForMapId(mapId);
		},

		searchAllMaps(query) {
			if (!query) return [];
			const lowerQuery = query.toLowerCase();
			const results = [];

			for (let idx = 0; idx < g_MonsterMapDataArray.length; idx++) {
				const mapData = g_MonsterMapDataArray[idx];
				if (!mapData) continue;

				// カテゴリは除外（KINDがCATEGORYのもの）
				if (mapData[MONSTER_MAP_DATA_INDEX_KIND] === MONSTER_MAP_KIND_CATEGORY) continue;

				const mapId = mapData[MONSTER_MAP_DATA_INDEX_ID];
				const mapName = mapData[MONSTER_MAP_DATA_INDEX_NAME_KANA_ARRAY]?.[0]?.[0] ?? "";
				if (!mapName) continue;

				if (mapName.toLowerCase().includes(lowerQuery)) {
					const categoryId = this.getCategoryIdForMapId(mapId);
					const categoryName = TinyMapMonster.Repo.getCategoryName(categoryId);
					results.push({
						id: mapId,
						name: mapName,
						displayName: `[${categoryName}] ${mapName}`,
					});
				}
			}

			return results;
		},

		setQuery(query) {
			this.state.query = query ?? "";
			this.render();
		},

		setCategory(categoryId) {
			this.state.selectedCategoryId = categoryId;
			this.state.query = "";
			this.render();
		},

		onSelect(categoryIdNullable, mapId) {
			this.close();

			const actualCategoryId = categoryIdNullable ?? this.getCategoryIdForMapId(mapId);
			const monsterId = TinyMapMonster.Repo.getCurrentMonsterId();
			CMonsterMapAreaComponentManager.ChangeSelect(actualCategoryId, mapId, monsterId, true);
		},

		render() {
			const modal = this.getContent();
			if (modal.length === 0) return;
			modal.empty();

			const currentMonsterId = TinyMapMonster.Repo.getCurrentMonsterId();
			const currentMapId = TinyMapMonster.Repo.getEffectiveMapId(currentMonsterId);
			const categories = this.getCategoryList();

			const selectedCategoryId = this.state.selectedCategoryId;
			const selectedCategoryName = TinyMapMonster.Repo.getCategoryName(selectedCategoryId);

			// Header (breadcrumb + search)
			const breadcrumb = TinyMapMonster.UI.createBreadcrumb([
				$("<span>").text("地域"),
				$("<span>", { css: { fontWeight: "bold", color: "#333" } }).text(selectedCategoryName),
			]);

			const searchBox = TinyMapMonster.UI.createSearchBox({
				placeholder: "マップ検索...",
				value: this.state.query,
				onChange: (q) => this.setQuery(q),
			});

			const header = TinyMapMonster.UI.createHeader(breadcrumb, searchBox);
			modal.append(header);

			// Category section (検索時は非表示)
			if (!this.state.query) {
				const categorySection = $("<div>", {
					css: {
						display: "flex",
						flexWrap: "wrap",
						gap: "3px",
						marginBottom: "12px",
						paddingBottom: "8px",
						borderBottom: "1px solid #ddd",
					},
				});

				const maxWidth = TinyMapMonster.UI.measureMaxWidth(
					categories.map((c) => c.name),
					{ fontSize: "11px", padding: "2px 6px" }
				);

				categories.forEach((cat) => {
					const isSelected = cat.id === selectedCategoryId;
					const btn = $("<button>", {
						type: "button",
						css: {
							padding: "2px 6px",
							fontSize: "11px",
							backgroundColor: isSelected ? "#FF7777" : "#f5f5f5",
							border: "1px solid #ccc",
							borderRadius: "3px",
							cursor: "pointer",
							textAlign: "center",
							width: maxWidth + "px",
							boxSizing: "border-box",
							whiteSpace: "nowrap",
						},
						click: () => this.setCategory(cat.id),
					}).text(cat.name);
					categorySection.append(btn);
				});

				modal.append(categorySection);
			}

			// Map section
			const mapSection = $("<div>", {
				css: {
					display: "flex",
					flexWrap: "wrap",
					gap: "5px",
					justifyContent: "center",
					alignContent: "flex-start",
					flex: 1,
					overflowY: "auto",
				},
			});

			const maps = this.state.query
				? this.searchAllMaps(this.state.query)
				: this.getMapListForCategory(selectedCategoryId);

			if (maps.length === 0) {
				mapSection.append($("<span>", { css: { color: "#999" } }).text("マップがありません"));
			} else {
				TinyMapMonster.UI.renderButtonGrid({
					container: mapSection,
					items: maps,
					getText: (m) => (m.displayName || m.name),
					isSelected: (m) => (m.id === currentMapId),
					onClick: (m) => this.onSelect(this.state.query ? null : selectedCategoryId, m.id),
					query: this.state.query,
					highlight: true,
					buttonCssBase: {
						padding: "5px 10px",
						backgroundColor: "white",
						border: "1px solid #ccc",
						borderRadius: "3px",
						cursor: "pointer",
					},
					buttonCssSelected: {
						backgroundColor: "#FF7777",
					},
				});
			}

			modal.append(mapSection);
			TinyMapMonster.UI.focusSearchBox(modal, this.state.query);
		},
	};

	// ===== Monster Modal =====
	static MobModal = {
		modalId: "TinyMapMonster-mob-modal",
		contentId: "TinyMapMonster-mob-modal-content",
		state: {
			query: "",
		},

		open() {
			this.close();
			this.state.query = "";

			const overlay = TinyMapMonster.UI.createModalOverlay({
				id: this.modalId,
				onOuterClickClose: () => this.close(),
			});
			const content = TinyMapMonster.UI.createModalContent({ id: this.contentId });

			overlay.append(content);
			$("body").append(overlay);

			this.render();
		},

		close() {
			$(`#${this.modalId}`).remove();
		},

		getContent() {
			return $(`#${this.contentId}`);
		},

		getMonsterListForCurrentMap() {
			const monsterId = TinyMapMonster.Repo.getCurrentMonsterId();
			const mapId = TinyMapMonster.Repo.getEffectiveMapId(monsterId);
			const dataIdArray = TinyMapMonster.Repo.getMapMonsterIds(mapId);
			if (!dataIdArray) return [];

			return dataIdArray.map((id) => ({
				id,
				name: TinyMapMonster.Repo.getMonsterName(id),
			}));
		},

		searchAllMonsters(query) {
			if (!query) return [];
			const lowerQuery = query.toLowerCase();
			const results = [];

			for (let idx = 0; idx < g_MonsterMapDataArray.length; idx++) {
				const mapData = g_MonsterMapDataArray[idx];
				if (!mapData) continue;
				if (mapData[MONSTER_MAP_DATA_INDEX_KIND] === MONSTER_MAP_KIND_CATEGORY) continue;

				const mapId = mapData[MONSTER_MAP_DATA_INDEX_ID];
				const mapName = mapData[MONSTER_MAP_DATA_INDEX_NAME_KANA_ARRAY]?.[0]?.[0] ?? "";
				const monsterIdArray = mapData[MONSTER_MAP_DATA_INDEX_DATA_ARRAY];
				if (!monsterIdArray) continue;

				monsterIdArray.forEach((monsterId) => {
					const monsterName = MonsterObjNew?.[monsterId]?.[MONSTER_DATA_INDEX_NAME] ?? "";
					if (!monsterName) return;
					if (monsterName.toLowerCase().includes(lowerQuery)) {
						results.push({
							id: monsterId,
							mapId: mapId,
							name: monsterName,
							displayName: `[${mapName}] ${monsterName}`,
						});
					}
				});
			}

			return results;
		},

		setQuery(query) {
			this.state.query = query ?? "";
			this.render();
		},

		onSelect(monsterId, mapIdNullable) {
			this.close();

			// 検索から選択された場合はマップも変更
			const mapId = (mapIdNullable != null) ? mapIdNullable : TinyMapMonster.Repo.getCurrentMapId();
			const categoryId = (mapIdNullable != null)
				? TinyMapMonster.MapModal.getCategoryIdForMapId(mapIdNullable)
				: CMonsterMapAreaComponentManager.GetCategoryId();

			CMonsterMapAreaComponentManager.ChangeSelect(categoryId, mapId, monsterId, true);
		},

		render() {
			const modal = this.getContent();
			if (modal.length === 0) return;
			modal.empty();

			const currentMonsterId = TinyMapMonster.Repo.getCurrentMonsterId();
			const currentMapId = TinyMapMonster.Repo.getEffectiveMapId(currentMonsterId);
			const currentMapName = TinyMapMonster.Repo.getMapName(currentMapId);

			// Header (title + search)
			const title = TinyMapMonster.UI.createBreadcrumb([
				$("<span>").text("モンスター"),
				$("<span>", { css: { fontWeight: "bold", color: "#333" } }).text(currentMapName),
			]);

			const searchBox = TinyMapMonster.UI.createSearchBox({
				placeholder: "モンスター検索...",
				value: this.state.query,
				onChange: (q) => this.setQuery(q),
			});

			const header = TinyMapMonster.UI.createHeader(title, searchBox);
			modal.append(header);

			// Mob section
			const mobSection = $("<div>", {
				css: {
					display: "flex",
					flexWrap: "wrap",
					gap: "5px",
					justifyContent: "center",
					alignContent: "flex-start",
					flex: 1,
					overflowY: "auto",
				},
			});

			const monsters = this.state.query
				? this.searchAllMonsters(this.state.query)
				: this.getMonsterListForCurrentMap();

			if (monsters.length === 0) {
				mobSection.append($("<span>", { css: { color: "#999" } }).text("モンスターがいません"));
			} else {
				TinyMapMonster.UI.renderButtonGrid({
					container: mobSection,
					items: monsters,
					getText: (m) => (m.displayName || m.name),
					isSelected: (m) => (m.id === currentMonsterId),
					onClick: (m) => this.onSelect(m.id, m.mapId),
					query: this.state.query,
					highlight: true,
					buttonCssBase: {
						padding: "5px 10px",
						backgroundColor: "white",
						border: "1px solid #ccc",
						borderRadius: "3px",
						cursor: "pointer",
					},
					buttonCssSelected: {
						backgroundColor: "#FF7777",
					},
				});
			}

			modal.append(mobSection);
			TinyMapMonster.UI.focusSearchBox(modal, this.state.query);
		},
	};

	// ===== 外部公開API（互換維持・委譲のみ） =====
	static getCurrentMapId() {
		return this.Repo.getCurrentMapId();
	}

	static getCurrentMapDivisor() {
		return this.Damage.getCurrentMapDivisor();
	}

	static getMobDivisor(mobName) {
		return this.Damage.getMobDivisor(mobName);
	}

	static getSelectedDivisor() {
		return this.Damage.getSelectedDivisor();
	}

	static runWithMobConfBufTabOpened(fn) {
		return this.Damage.runWithMobConfBufTabOpened(fn);
	}

	static getMobConfBufDamageDivideSelect() {
		return this.Damage.getMobConfBufDamageDivideSelect();
	}

	static setDamageDivideByDivisor(divisor) {
		return this.Damage.setDamageDivideByDivisor(divisor);
	}

	static onClicked(enabled, divisor) {
		this.runWithMobConfBufTabOpened(() => {
			this.setDamageDivideByDivisor(enabled ? divisor : 1);
		});
		calc();
	}

	static getCategoryList() {
		return this.MapModal.getCategoryList();
	}

	static getMapListForCategory(categoryId) {
		return this.MapModal.getMapListForCategory(categoryId);
	}

	static getCategoryIdForCurrentMap() {
		return this.MapModal.getCategoryIdForCurrentMap();
	}

	static onMapButtonClicked() {
		this.MapModal.open();
	}

	static highlightSearchText(text, query) {
		return this.UI.highlight(text, query);
	}

	static searchAllMaps(query) {
		return this.MapModal.searchAllMaps(query);
	}

	static renderDrilldownUI(selectedCategoryId, searchQuery = "") {
		this.MapModal.state.selectedCategoryId = selectedCategoryId;
		this.MapModal.state.query = searchQuery ?? "";
		this.MapModal.render();
	}

	static getCategoryIdForMapId(mapId) {
		return this.MapModal.getCategoryIdForMapId(mapId);
	}

	static onMapSelected(categoryId, mapId) {
		this.MapModal.onSelect(categoryId, mapId);
	}

	static closeMapModal() {
		this.MapModal.close();
	}

	static getMonsterListForCurrentMap() {
		return this.MobModal.getMonsterListForCurrentMap();
	}

	static searchAllMonsters(query) {
		return this.MobModal.searchAllMonsters(query);
	}

	static onMobButtonClicked() {
		this.MobModal.open();
	}

	static renderMobModalUI(searchQuery = "") {
		this.MobModal.state.query = searchQuery ?? "";
		this.MobModal.render();
	}

	static onMobSelected(monsterId, mapId) {
		this.MobModal.onSelect(monsterId, mapId);
	}

	static closeMobModal() {
		this.MobModal.close();
	}

	static render(mobData) {
		const monsterId = mobData[MONSTER_DATA_INDEX_ID];
		const mapId = this.Repo.getEffectiveMapId(monsterId);
		const mapName = this.Repo.getMapName(mapId);
		const mobName = mobData[MONSTER_DATA_INDEX_NAME];

		const mapDivisor = this.MAP_DAMAGE_DIVISOR_BY_MAP_ID[mapId] ?? 1;
		const mobDivisor = this.Damage.getMobDivisor(mobName);
		const totalDivisor = mapDivisor * mobDivisor;

		const selectedDivisor = this.Damage.getSelectedDivisor();
		const enabled = (totalDivisor === selectedDivisor);

		const prettyDiv = (div) => this.Damage.prettyDiv(div);

		// MAPボタン
		const mapButton = $("<button>", {
			type: "button",
			class: "tooltip-target enoch-open-button",
			onclick: "TinyMapMonster.onMapButtonClicked()",
			"data-tooltip": `マップ: ${prettyDiv(mapDivisor)}`,
		}).text(`${mapName}🔍`);

		// MOBボタン
		const mobButton = $("<button>", {
			type: "button",
			class: "tooltip-target enoch-open-button",
			onclick: "TinyMapMonster.onMobButtonClicked()",
			"data-tooltip": TinyMapMonster.Damage.getMobNotification(mobName),
		}).text(`${mobName}🔍`);

		// ダメージ減衰ボタン
		const damageTitle = [
			`マップ: ${prettyDiv(mapDivisor)} [${mapName}]`,
			`敵特性: ${prettyDiv(mobDivisor)} [${mobName}]`,
			`　合算: ${prettyDiv(totalDivisor)}`,
		].join("\n");

		const damageButton = $("<button>", {
			type: "button",
			class: "tooltip-target",
			style: enabled ? "background-color: #FF7777;" : "background-color: white;",
			onclick: `TinyMapMonster.onClicked(${!enabled}, ${totalDivisor})`,
			"data-tooltip": damageTitle,
			"aria-label": damageTitle,
		}).text(`ダメ${prettyDiv(totalDivisor)}`);

		$("#OBJID_DIV_MAP_MONSTER_TINY").empty().append(mapButton, mobButton, damageButton);
	}
}
