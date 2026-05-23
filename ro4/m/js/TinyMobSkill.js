/**
 * 簡易戦闘結果「被XX」の可変表示用データ＆検索ロジック.
 *
 * 概要:
 *   モンスターが特定スキルXX（テトラボルテックス等）を使う場合だけ、
 *   簡易戦闘結果(OBJID_DIV_BATTLE_RESULT_TINY)に「被XX」を表示する。
 *   従来は「被テトラ」が全モンスターで固定表示されていたのを、
 *   モンスター毎の使用スキルに応じて可変にしたもの。
 *
 * 役割分担:
 *   - 本モジュール … 辞書(スキル→モンスター / スキル→計算条件) + 検索 + 物理魔法の振り分け
 *                   + 簡易戦闘結果への描画まで。head.js から呼ぶ入口は render() の1つだけ。
 *   - head.js     … 被ダメ計算2関数(calcReceivedDamageByCondition / calcReceivedMagicDamageByCondition)
 *                   を「参照」として render() に注入し、render() を1回呼ぶだけ。
 *
 * なぜ計算関数だけ head.js に残すか:
 *   計算関数は n_tok / zokusei / UsedSkillSearch / GetRes 等、head.js の module スコープ変数群に
 *   密結合している(これらは window 非公開)。本体を別モジュールへ移すと参照不能で壊れるため、
 *   head.js に置いたまま「関数参照」を render() に外部注入(DI)する。window グローバルは増やさない。
 *
 * 本家無改変方針(CLAUDE.md):
 *   head.js の本家関数は一切改変していない。注入される計算関数のうち魔法側は本家 calcReceivedMagicDamage
 *   の計算式を複製したものなので、本家側の式が更新されたら head.js の複製関数を手で追従させること。
 *
 * データ取得(条件1: スキル→モンスター):
 *   Google で「site:rotool.gungho.jp/monster "<スキル名>"」を検索し、
 *   ヒットした個別ページのタイトル(=モンスター名)を MONSTERS_BY_SKILL の
 *   該当スキル配列に1行1体で貼る（検索結果1回ぶんを丸ごと貼り替える運用）。
 *   スキル名(XX)の定義域は SKILL_INFO のキー(テトラボルテックス /
 *   デモニックヘルジャッジメント / Mレイオブジェネシス / アースクエイク)。
 */
class TinyMobSkill {

	// ============================================================
	// 条件2: スキル情報（被ダメ計算条件） スキル名 → { ratio, element, label, type?, hint? }
	//   ratio   : 被ダメ計算の skillRatio (%, 100-60000)
	//   element : 攻撃属性。属性キー文字列("VANITY"等) または ELM_ID_* の数値。
	//   label   : 「被XX」表示用の短縮名(省略時はスキル名そのまま)
	//   type    : "magic"(魔法) または "physical"(物理)。省略時は "magic"。
	//             rotool のスキル個別ページに 物理/魔法 の区別があるのでそれに合わせる。
	//             magic → calcReceivedMagicDamageByCondition、
	//             physical → calcReceivedDamageByCondition で計算する。
	//   hint    : ツールチップ文(省略時は type/ratio/element から自動生成)
	//
	//   ※ テトラ以外は【要確認】の暫定値。属性・物理魔法区分は推定、倍率は仮置き。
	//     rotool 等の公式情報で ratio / element / type を確定させること。
	// ============================================================
	static SKILL_INFO = {
		"テトラボルテックス":            { ratio: 10000, element: "VANITY", label: "テトラ",     type: "magic" },
		"デモニックヘルジャッジメント":  { ratio: 5000,  element: "VANITY", label: "デモHJ",     type: "physical" },
		"Mレイオブジェネシス":           { ratio: 16000, element: "HOLY",   label: "レイジェネ", type: "magic" },
		"アースクエイク":                { ratio: 5000,  element: "VANITY", label: "EQ",         type: "magic" },
	};

	// ============================================================
	// 条件1: スキル→モンスター辞書（手編集で拡充。これが「真実のソース」）
	//   key   : スキル名 (SKILL_INFO のキー)
	//   value : そのスキルを使うモンスター名の配列（1行1体）
	//           モンスター名は mobData[MONSTER_DATA_INDEX_NAME] と完全一致する文字列。
	//
	//   ★ データの持ち方の方針 ★
	//   取得は Google「site:rotool.gungho.jp/monster "<スキル名>"」→ モンスター一覧、
	//   つまり「スキル→モンスター」の形で入ってくる。保存形をそれに合わせることで、
	//   検索結果を1ブロックそのまま貼り替えるだけのメンテにできる。
	//   - 同じモンスターが複数スキルのリストに重複して並んでOK（正規化しない）。
	//   - 1行1体なので、行単位のコピペ/削除で編集できる。
	//   - 描画に必要な「モンスター→スキル集合」は getSkillsByMonster() が
	//     初回アクセス時に1度だけ逆引き構築する（重複モンスターのマージはそこで自動）。
	//
	//   空の間は「被XX」は一切表示されない（テトラも含め）。
	// ============================================================
	static MONSTERS_BY_SKILL = {
		// site:rotool.gungho.jp/monster "テトラボルテックス"
		"テトラボルテックス": [
			"コーラルマリン",
			"ベテルギウス",
			"呪殺のヒメルメズ（4th）",
			"憤怒のカトリーヌ（インフェルノ）",
			"憤怒のカトリーヌ（インフェルノ）（MVP）",
			"憤怒のカトリーヌ（インフェルノ）（MVP）（取り巻き）",
			"憤怒のカトリーヌ（インフェルノ）（強力な憤怒の思念体）",
			"暴食の堕ちた大神官（インフェルノ）",
			"暴食の堕ちた大神官（ノーマル）",
			"暴食の魔王の分身（ノーマル）",
			"暴食の魔王ヴェルゼブブ（インフェルノ）",
			"次元犯罪者リゲル（難易度★★★★）",
			"次元犯罪者リゲル（難易度★★★）",
			"次元犯罪者リゲル（難易度★★）",
			"次元犯罪者リゲル（難易度★）",
			"深海のデビアス",
			"混沌を呼ぶ魔女",
			"白の竜",
			"魔剣士サクライ",
		],

		// site:rotool.gungho.jp/monster "デモニックヘルジャッジメント"
		"デモニックヘルジャッジメント": [
			"アモンラー（星座の塔）",
			"ガイダンス・キッド",
			"全てを屠りし英雄",
			"呪いのレイス",
			"呪いのレイス（取り巻き）",
			"呪殺のヒメルメズ",
			"呪殺のヒメルメズ（4th）",
			"堕落の魔眼",
			"堕落の魔眼（4th）",
			"得体の知れない生命体",
			"暴食の堕ちた大神官（ノーマル）",
			"混沌を呼ぶ魔女",
			"破損したタナトスの記憶",
		],

		// site:rotool.gungho.jp/monster "Mレイオブジェネシス"
		"Mレイオブジェネシス": [
			"アクィラ",
			"アンデッドソルジャー",
			"エルジェーベト",
			"クリーニングロボット",
			"シャドウカッパ（亜空の迷宮）",
			"ジクラウス",
			"デッドソウル",
			"パピラルバ",
			"メイプルツリー",
			"ランデル=ロレンス（三次職）",
			"ランデル=ロレンス（三次職）（MVP）",
			"ランデル=ロレンス（三次職）（オーラ）",
			"ランデル=ロレンス（三次職）（オーラ）（取り巻き）",
			"ランドグリス（星座の塔）",
			"ルナリナ",
			"レッドペッパーカッパ",
			"レディ・C・ムーン",
			"ロックサベージ",
			"上級パピラカイ",
			"不凍花",
			"光に包まれた魔獣",
			"冷徹な執行する者",
			"冷徹な執行する者（取り巻き）",
			"単眼ドロカリス",
			"呪いの参式魔剣",
			"呪いの壱式魔剣",
			"呪いの弐式魔剣",
			"商人の影（MD）",
			"変貌の白騎士",
			"変貌の白騎士（4th）",
			"大きな緑の竜",
			"天より堕ちし御使い",
			"太古の骨の王",
			"女神の守護者（オーラ）",
			"強化Gスパイダー",
			"強化Gホーネット",
			"強化キラーマンティス",
			"強靭なシャイディエスト",
			"強靭なルナリナ",
			"憤怒のマーガレッタ（インフェルノ）（MVP）",
			"憤怒のマーガレッタ（インフェルノ）（オーラ）",
			"憤怒のマーガレッタ（インフェルノ）（強力な憤怒の思念体）",
			"憤怒のランデル（インフェルノ）",
			"憤怒のランデル（インフェルノ）（強力な憤怒の思念体）",
			"時を刻む管理者",
			"暴食のネクロマンサー（インフェルノ）",
			"暴食のネクロマンサー（ノーマル）",
			"暴食のバンシー（インフェルノ）",
			"暴食のバンシー（ノーマル）",
			"暴食の変異ネクロ（インフェルノ）",
			"暴食の変異ネクロ（ノーマル）",
			"暴食の変異バンシー（インフェルノ）",
			"暴食の変異バンシー（ノーマル）",
			"毒沼の捕食者",
			"洞窟不凍花",
			"深海のスロフォ",
			"混沌を呼ぶ魔女",
			"無名のアコライト（4thモード）（1）",
			"無限のSドロップス（ファロス・ライトハウス・アドベンチャー）",
			"無限のキングポリン（ファロス・ライトハウス・アドベンチャー）",
			"無限のケーキポリン（ファロス・ライトハウス・アドベンチャー）",
			"無限のバドンX（ファロス・ライトハウス・アドベンチャー）",
			"無限のミニネコリン（ファロス・ライトハウス・アドベンチャー）",
			"真夜中のハゼ",
			"真夜中のフェンリル",
			"真夜中のレチェニエ",
			"祈る者",
			"祈る者（取り巻き）",
			"緑の竜",
			"聖殿のAエンジェリング",
			"聖殿のランドグリス",
			"覚醒ヨスコプス魔術師",
			"赤の竜",
			"超越体ヒメルメズ",
			"雪嵐天使ウミウシ",
		],

		// site:rotool.gungho.jp/monster "アースクエイク"
		"アースクエイク": [
			"R001-ベスティア",
			"R001-ベスティア（亜空の迷宮）",
			"R48-85-ベスティア",
			"R48-85-ベスティア（亜空の迷宮）",
			"RSX-0806",
			"S・J・アーネストウルフ",
			"アトロス（星座の塔）",
			"アルトフィッシュ（MH）",
			"アルフォシオ=バジル（三次職）（MVP）",
			"アルメリア",
			"アンデッドウィザード",
			"アーティス=マスコット",
			"アーティス=マスコット（MD）",
			"イフリート（A）（MD）",
			"イフリート（星座の塔）",
			"エミュール=プラメール（三次職）（MVP）",
			"エレメス=ガイル（三次職）（MVP）",
			"オークロード（MD）",
			"オークロード（星座の塔）",
			"カトリーヌ=ケイロン（三次職）（MVP）",
			"ガーティー=ウー（三次職）（MVP）",
			"クラーケン",
			"グリーンピタヤ",
			"グリーンピタヤ（取り巻き）",
			"グレーアイスウィンド",
			"ゴーストマスター",
			"シャドウモロク（MD）",
			"ジャイアントオクトパス",
			"セイレン=ウィンザー（三次職）（MVP）",
			"セシル=ディモン（三次職）（MVP）",
			"セリア=アルデ（三次職）（MVP）",
			"ゼラニウム",
			"ソスピタ",
			"チェン=リウ（三次職）（MVP）",
			"トレンティーニ（三次職）（MVP）",
			"ナタリス",
			"ニーズヘッグの影（MD）",
			"ハワード=アルトアイゼン（三次職）（MVP）",
			"ハードロックマンモス",
			"バフォメット（星座の塔）",
			"パンチバグ",
			"ブルガサリ",
			"ホワイトアイスウィンド",
			"マーガレッタ=ソリン（三次職）（MVP）",
			"メイプルツリー",
			"モロクの現身（物質型）",
			"モロクの現身（物質型）（取り巻き）",
			"ユーベルフィッシュ（MH）",
			"ランデル=ロレンス（三次職）（MVP）",
			"ランドグリス（MD）",
			"ランドグリス（亜空の迷宮）",
			"ランドグリス（星座の塔）",
			"ルガンチーフクリーナー",
			"ロックサベージ",
			"ローラ",
			"光に包まれた魔獣",
			"再生の半魔神",
			"古のタオグンカ（亜空の迷宮）",
			"呪殺のヒメルメズ（4th）",
			"囚人 95EB72",
			"堕落の魔眼",
			"堕落の魔眼（4th）",
			"天使ウミウシ（MD）",
			"天使ウミウシ（取り巻き）",
			"太古のモロク",
			"女王フェイスワーム",
			"女王フェイスワーム（赤）",
			"女王フェイスワーム（黄）",
			"彷徨い続けるキメラ",
			"彷徨う紫色の竜（MD）",
			"悪夢のバフォメット",
			"暴食の堕ちた大神官（インフェルノ）",
			"暴食の魔王の分身（インフェルノ）",
			"暴食の魔王の分身（ノーマル）",
			"暴食の魔王ヴェルゼブブ（インフェルノ）",
			"次元の軍団兵士長",
			"次元犯罪者リゲル（難易度★★★★）",
			"次元犯罪者リゲル（難易度★★★）",
			"次元犯罪者リゲル（難易度★★）",
			"次元犯罪者リゲル（難易度★）",
			"殺戮の魔眼",
			"混沌のバフォメット（MD）",
			"生者を求める亡者",
			"瘴気に包まれた猛獣",
			"白の竜",
			"真夜中のディワイ",
			"祓い浄められた随身",
			"紫の竜",
			"誘いの魔眼",
			"赤の竜",
			"輝くベアドール（MD）",
			"迷宮のバフォメット（A）（MD）",
			"迷宮のバフォメット（B）（MD）",
			"迷宮のバフォメット（C）（MD）",
			"雪ウサギウミウシ",
			"頭領タコ",
			"飢える大蜘蛛",
			"魔剣士サクライ",
			"黄泉国の呼び声",
			"黒の竜",
		],
	};

	// 描画用の逆引き索引: モンスター名 → Set<スキル名>。
	// MONSTERS_BY_SKILL から初回アクセス時に1度だけ構築（重複モンスターは Set で自動マージ）。
	static _skillsByMonster = null;

	static getSkillsByMonster() {
		if (this._skillsByMonster) return this._skillsByMonster;
		const map = new Map();
		for (const [skillName, mobs] of Object.entries(this.MONSTERS_BY_SKILL)) {
			for (const mobName of mobs) {
				let set = map.get(mobName);
				if (!set) { set = new Set(); map.set(mobName, set); }
				set.add(skillName);
			}
		}
		this._skillsByMonster = map;
		return map;
	}

	// ===== 属性キー解決（ELM_ID_* は common.js が window に定義する疑似定数）=====
	static _elementTable = null;

	static getElementTable() {
		// 呼び出し時に解決（モジュール評価順に依存しないよう遅延構築）
		if (this._elementTable) return this._elementTable;
		this._elementTable = {
			VANITY: { id: ELM_ID_VANITY, disp: "無属性" },
			WATER:  { id: ELM_ID_WATER,  disp: "水属性" },
			EARTH:  { id: ELM_ID_EARTH,  disp: "地属性" },
			FIRE:   { id: ELM_ID_FIRE,   disp: "火属性" },
			WIND:   { id: ELM_ID_WIND,   disp: "風属性" },
			POISON: { id: ELM_ID_POISON, disp: "毒属性" },
			HOLY:   { id: ELM_ID_HOLY,   disp: "聖属性" },
			DARK:   { id: ELM_ID_DARK,   disp: "闇属性" },
			PSYCO:  { id: ELM_ID_PSYCO,  disp: "念属性" },
			UNDEAD: { id: ELM_ID_UNDEAD, disp: "不死属性" },
		};
		return this._elementTable;
	}

	// element(文字列キー or 数値) → ELM_ID 数値
	static resolveElementId(element) {
		if (typeof element === "number") return element;
		const ent = this.getElementTable()[element];
		return ent ? ent.id : ELM_ID_VANITY;
	}

	// element(文字列キー or 数値) → 表示名("無属性"等)
	static resolveElementDisp(element) {
		const table = this.getElementTable();
		if (typeof element === "number") {
			for (const key in table) {
				if (table[key].id === element) return table[key].disp;
			}
			return "無属性";
		}
		const ent = table[element];
		return ent ? ent.disp : "無属性";
	}

	/**
	 * モンスター名から「被XX」描画対象の配列を返す.
	 * render() がこの戻り値を回して描画する（type で物理/魔法の計算関数を振り分ける）。
	 *
	 * @param {string} mobName mobData[MONSTER_DATA_INDEX_NAME]
	 * @returns {Array<{skillName:string,label:string,ratio:number,element:number,type:string,hint:string}>}
	 *          type は "magic" | "physical"
	 */
	static getSkillsForMonster(mobName) {
		const skillNames = this.getSkillsByMonster().get(mobName);
		if (!skillNames || skillNames.size === 0) return [];

		const out = [];
		for (const skillName of skillNames) {
			const info = this.SKILL_INFO[skillName];
			if (!info) continue;                                   // 未定義スキルは無視
			if (info.ratio == null || info.element == null) continue; // 未設定はスキップ

			const elementId = this.resolveElementId(info.element);
			const label = info.label ?? skillName;
			const dispElm = this.resolveElementDisp(info.element);
			const type = (info.type === "physical") ? "physical" : "magic";
			const kindName = (type === "physical") ? "物理" : "魔法";
			const hint = info.hint ?? `${kindName}${info.ratio}%\n${dispElm}で受ける${kindName}ダメージ`;

			out.push({ skillName, label, ratio: info.ratio, element: elementId, type, hint });
		}
		return out;
	}

	/**
	 * 簡易戦闘結果(OBJID_DIV_BATTLE_RESULT_TINY)に「被XX」行を追記する（機能の入口）.
	 * 辞書参照・物理魔法の振り分け・描画を本メソッドに集約。被ダメ計算関数は head.js の
	 * 戦闘状態(n_tok等)に密結合のため、呼び出し側(head.js)から参照を注入してもらう。
	 *
	 * @param {*} charaData
	 * @param {*} mobData
	 * @param {{calcPhysical:Function, calcMagic:Function}} calc
	 *        head.js の被ダメ計算関数。いずれも引数は (charaData, mobData, ratio, element)。
	 */
	static render(charaData, mobData, calc) {
		const grid = document.getElementById("OBJID_DIV_BATTLE_RESULT_TINY");
		if (!grid || !calc) return;

		const mobName = mobData[MONSTER_DATA_INDEX_NAME];
		for (const ent of this.getSkillsForMonster(mobName)) {
			const calcFn = (ent.type === "physical") ? calc.calcPhysical : calc.calcMagic;
			if (typeof calcFn !== "function") continue;
			const value = calcFn(charaData, mobData, ent.ratio, ent.element);
			this.appendTinyRow(grid, `被${ent.label}`, __DIG3(value), ent.hint);
		}
	}

	/**
	 * 簡易戦闘結果の1行(ラベルspan + 値span)を grid へ追記する.
	 * head.js の funcRenderResultTinyHtml と同じDOM構造/CSSクラスを再現したもの
	 * （あちらは関数内ローカルで外部から呼べないため。値spanは CSSCLS_BATTLE_TINY_VALUE を保持しつつ
	 * tooltip-target を併せ持たせる）。
	 */
	static appendTinyRow(grid, labelText, valueText, tooltip) {
		const label = HtmlCreateElement("span", grid);
		label.classList.add("CSSCLS_BATTLE_TINY_LABEL");
		HtmlCreateTextNode(labelText, label);

		const value = HtmlCreateElement("span", grid);
		value.classList.add("CSSCLS_BATTLE_TINY_VALUE");
		HtmlCreateTextNode(valueText, value);
		if (tooltip) {
			value.classList.add("tooltip-target");
			value.setAttribute("data-tooltip", tooltip);
		}
	}
}

if (typeof window !== 'undefined') {
	window.TinyMobSkill = TinyMobSkill;
}
