// src/scenes/BattleScene.js (問題2「多重防止に引っかかる」を解決するための修正 - ステップ1-1)

import HpBar from '../ui/HpBar.js';
import CoinHud from '../ui/CoinHud.js';
import { ITEM_DATA } from '../core/ItemData.js'; // ItemDataのimportを確認

export default class BattleScene extends Phaser.Scene {
    constructor() {
        super('BattleScene');
        this.receivedParams = null;
        this.stateManager = null;
        this.playerHpBar = null;
        this.enemyHpBar = null;
        this.coinHud = null;

        this.backpackGridSize = 6;
        this.cellSize = 60;
        this.gridX = 0;
        this.gridY = 0;
        this.backpack = null; // アイテム配置の状態 (二次元配列)
        this.inventoryItems = []; // インベントリのアイテム画像を格納する配列 (Phaser.GameObjects.Image)
        this.backpackGridObjects = []; // バックパックのグリッド線や背景などのPhaserオブジェクトを格納する配列

        this.playerStats = { attack: 0, defense: 0, hp: 0 }; 
        this.enemyStats = { attack: 0, defense: 0, hp: 0 };  

        this.initialBattleParams = null; // シーンの初期パラメータ (リトライ用)
        this.battleEnded = false; // 戦闘終了フラグ (endBattleの二重呼び出し防止)
        this.battleLogText = null; // 戦闘ログ表示用テキストオブジェクト

        // UIボタンへの参照
        this.winButton = null;
        this.loseButton = null;
        this.retryButton = null;
        this.titleButton = null;
        this.gameOverText = null;

        this.onFVariableChangedListener = null; // StateManagerのイベントリスナー参照

        // ★★★ 追加: BattleSceneからSystemSceneへのイベント発行済みフラグ ★★★
        this.eventEmitted = false;

        // ★★★ 追加: create()で作成するその他のPhaserオブジェクトの参照を初期化 ★★★
        this.playerPlaceholderText = null;
        this.enemyPlaceholderText = null;
        this.startBattleButton = null;
    }

    init(data) {
        this.receivedParams = data.transitionParams || {}; 
        console.log("ActionScene (as BattleScene): init 完了。受け取ったパラメータ:", this.receivedParams);

        this.initialBattleParams = {
            playerLevel: this.receivedParams.player_level || 1,
            playerName: this.receivedParams.player_name || 'プレイヤー',
            initialCoin: this.receivedParams.current_coin || 0,
            initialPlayerMaxHp: this.receivedParams.player_max_hp || 100, 
            initialPlayerHp: this.receivedParams.player_hp || this.receivedParams.player_max_hp || 100, 
        };
        console.log("ActionScene (as BattleScene): 初期バトルパラメータ:", this.initialBattleParams);

        this.battleEnded = false; // init時にリセット
        this.eventEmitted = false; // ★★★ init時にイベント発行済みフラグもリセット ★★★
    }

    create() {
        console.log("ActionScene (as BattleScene): create 開始");
        this.cameras.main.setBackgroundColor('#8a2be2');

        const gameScene = this.scene.get('GameScene');
        if (gameScene && gameScene.stateManager) {
            this.stateManager = gameScene.stateManager;
        } else {
            console.error("ActionScene (as BattleScene): GameSceneのStateManagerが見つかりません。ゲーム変数は更新できません。");
        }

        // ★★★ 修正箇所: プレースホルダーテキストをプロパティに保持 ★★★
        this.playerPlaceholderText = this.add.text(100, 360, 'PLAYER', { fontSize: '48px', fill: '#fff' }).setOrigin(0.5);
        this.enemyPlaceholderText = this.add.text(this.scale.width - 100, 360, 'ENEMY', { fontSize: '48px', fill: '#fff' }).setOrigin(0.5);

        this.playerHpBar = new HpBar(this, 20, 20, 250, 30, 'player');
        this.enemyHpBar = new HpBar(this, this.scale.width - 20, 20, 250, 30, 'enemy');
        this.enemyHpBar.x -= this.enemyHpBar.barWidth;
        this.coinHud = new CoinHud(this, 100, 50);

        this.stateManager.f.player_max_hp = this.initialBattleParams.initialPlayerMaxHp; 
        this.stateManager.f.player_hp = this.initialBattleParams.initialPlayerHp;
        this.playerHpBar.setHp(this.stateManager.f.player_hp, this.stateManager.f.player_max_hp);

        this.stateManager.f.enemy_max_hp = 500; 
        this.stateManager.f.enemy_hp = 500; 
        this.enemyHpBar.setHp(this.stateManager.f.enemy_hp, this.stateManager.f.enemy_max_hp);

        this.coinHud.setCoin(this.initialBattleParams.initialCoin);

        this.onFVariableChangedListener = this.onFVariableChanged.bind(this);
        this.stateManager.events.on('f-variable-changed', this.onFVariableChangedListener);

        // バックパックのグリッド表示
        this.backpackGridSize = 6;
        this.cellSize = 60;
        this.gridWidth = this.backpackGridSize * this.cellSize;
        this.gridHeight = this.backpackGridSize * this.cellSize;
        this.gridX = this.scale.width / 2 - this.gridWidth / 2;
        this.gridY = this.scale.height / 2 - this.gridHeight / 2 + 50;

        // ★★★ 修正箇所: グリッドの背景と線をプロパティの配列に保持 ★★★
        this.backpackGridObjects.push(this.add.rectangle(this.gridX + this.gridWidth / 2, this.gridY + this.gridHeight / 2, this.gridWidth, this.gridHeight, 0x333333, 0.9).setOrigin(0.5).setDepth(10));
        for (let i = 0; i <= this.backpackGridSize; i++) {
            this.backpackGridObjects.push(this.add.line(0, 0, this.gridX, this.gridY + i * this.cellSize, this.gridX + this.gridWidth, this.gridY + i * this.cellSize, 0x666666, 0.5).setOrigin(0).setDepth(11));
            this.backpackGridObjects.push(this.add.line(0, 0, this.gridX + i * this.cellSize, this.gridY, this.gridX + i * this.cellSize, this.gridY + this.gridHeight, 0x666666, 0.5).setOrigin(0).setDepth(11));
        }

        this.backpack = Array(this.backpackGridSize).fill(null).map(() => Array(this.backpackGridSize).fill(0));

        // インベントリの表示
        const inventoryX = this.gridX - 180;
        const inventoryY = this.gridY;
        const inventoryWidth = 150;
        const inventoryHeight = this.gridHeight;
        // ★★★ 修正箇所: インベントリの背景とテキストもプロパティの配列に保持 ★★★
        this.backpackGridObjects.push(this.add.rectangle(inventoryX + inventoryWidth / 2, inventoryY + inventoryHeight / 2, inventoryWidth, inventoryHeight, 0x555555, 0.8).setOrigin(0.5).setDepth(10));
        this.backpackGridObjects.push(this.add.text(inventoryX + inventoryWidth / 2, inventoryY + 20, 'インベントリ', { fontSize: '24px', fill: '#fff' }).setOrigin(0.5).setDepth(11));

        const initialInventory = ['sword', 'shield', 'potion'];
        let itemY = inventoryY + 70;
        initialInventory.forEach(itemId => {
            const itemImage = this.createItem(itemId, inventoryX + inventoryWidth / 2, itemY);
            if (itemImage) { 
                this.inventoryItems.push(itemImage); // インベントリのアイテムを保持
            }
            itemY += 80;
        });

        // 「戦闘開始」ボタン
        this.startBattleButton = this.add.text(this.gridX - 105, this.gridY + this.gridHeight - 30, '戦闘開始', {
            fontSize: '28px',
            fill: '#fff',
            backgroundColor: '#008800',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(11);
        this.startBattleButton.on('pointerdown', () => {
            // ★★★ 追加: クリック時にボタンの入力を即座に無効化 ★★★
            this.startBattleButton.disableInteractive(); 
            this.input.enabled = false; // 全体入力も一時無効化 (戦闘中ドラッグさせないため)
            this.startBattle();
        });
        
        // 戦闘ログ表示用のテキストオブジェクト
        this.battleLogText = this.add.text(this.scale.width / 2, 150, '', {
            fontSize: '24px',
            fill: '#fff',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 10, y: 10 },
            align: 'center',
            wordWrap: { width: 400 }
        }).setOrigin(0.5).setDepth(200);

        // 戦闘結果ボタンの初期化（初期は非表示）
        this.winButton = this.add.text(320, 600, '勝利してノベルパートに戻る', { fontSize: '32px', fill: '#0c0', backgroundColor: '#000' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false); // 初期は非表示
        this.winButton.on('pointerdown', () => {
            // ★★★ 追加: クリック時にボタンの入力を即座に無効化 ★★★
            this.winButton.disableInteractive(); 
            if (this.loseButton) this.loseButton.disableInteractive();
            this.endBattle('win');
        });

        this.loseButton = this.add.text(this.scale.width - 320, 600, '敗北してゲームオーバー', { fontSize: '32px', fill: '#c00', backgroundColor: '#000' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false); // 初期は非表示
        this.loseButton.on('pointerdown', () => {
            // ★★★ 追加: クリック時にボタンの入力を即座に無効化 ★★★
            this.loseButton.disableInteractive(); 
            if (this.winButton) this.winButton.disableInteractive();
            this.endBattle('lose');
        });

        console.log("ActionScene (as BattleScene): create 完了");
    }

    startBattle() {
        console.log("戦闘開始！");
        // アイテムのドラッグ入力を無効化 (戦闘中はアイテムを動かせない)
        // this.input.setDraggable(this.inventoryItems, false); // これは個々のアイテムにリスナーがあるので、全体無効化でOK

        // プレースホルダーテキストやグリッド、アイテムを非表示にする（UX向上）
        if(this.playerPlaceholderText) this.playerPlaceholderText.setVisible(false);
        if(this.enemyPlaceholderText) this.enemyPlaceholderText.setVisible(false);
        this.backpackGridObjects.forEach(obj => obj.setVisible(false));
        this.inventoryItems.forEach(item => item.setVisible(false));
        if(this.startBattleButton) this.startBattleButton.setVisible(false);

        this.playerStats = { attack: 5, defense: 0, hp: this.stateManager.f.player_hp };
        this.enemyStats = { attack: 20, defense: 0, hp: this.stateManager.f.enemy_hp };

        const processedItems = new Set(); 
        for (let r = 0; r < this.backpackGridSize; r++) {
            for (let c = 0; c < this.backpackGridSize; c++) {
                const itemId = this.backpack[r][c];
                if (itemId !== 0) {
                    const uniqueCellId = `${itemId}-${r}-${c}`; 
                    if (!processedItems.has(uniqueCellId)) { 
                        const itemData = ITEM_DATA[itemId];
                        if (itemData && itemData.effects) {
                            this.playerStats.attack += itemData.effects.attack || 0;
                            this.playerStats.defense += itemData.effects.defense || 0;
                        }
                        processedItems.add(uniqueCellId); 
                    }
                }
            }
        }
        
        console.log(`プレイヤー最終ステータス: 攻撃=${this.playerStats.attack}, 防御=${this.playerStats.defense}`);
        this.addToBattleLog(`あなたのステータス: 攻撃=${this.playerStats.attack}, 防御=${this.playerStats.defense}`);
        
        const executeTurn = (turn) => {
            console.log(`--- Turn ${turn} ---`);

            this.time.delayedCall(1000, () => {
                if (this.battleEnded) return;

                const playerDamage = Math.max(0, this.playerStats.attack - this.enemyStats.defense);
                this.enemyStats.hp -= playerDamage;
                this.stateManager.eval(`f.enemy_hp = ${this.enemyStats.hp}`);
                this.addToBattleLog(`あなたの攻撃！敵に ${playerDamage} のダメージ！ (敵残りHP: ${Math.max(0, this.enemyStats.hp)})`);
                
                if (this.enemyStats.hp <= 0) {
                    this.addToBattleLog("敵を倒した！");
                    this.time.delayedCall(1000, () => this.endBattle('win'));
                    return;
                }

                this.time.delayedCall(1000, () => {
                    if (this.battleEnded) return;

                    const enemyDamage = Math.max(0, this.enemyStats.attack - this.playerStats.defense);
                    this.playerStats.hp -= enemyDamage;
                    this.stateManager.eval(`f.player_hp = ${this.playerStats.hp}`);
                    this.addToBattleLog(`敵の攻撃！あなたに ${enemyDamage} のダメージ！ (残りHP: ${Math.max(0, this.playerStats.hp)})`);
                    
                    if (this.playerStats.hp <= 0) {
                        this.addToBattleLog("あなたは倒れてしまった…");
                        this.time.delayedCall(1000, () => this.endBattle('lose'));
                        return;
                    }

                    executeTurn(turn + 1);
                });
            });
        };
        executeTurn(1);
    }
    
    addToBattleLog(text) {
        if (this.battleLogText) { 
            this.battleLogText.setText(text);
        }
    }

    createItem(itemId, x, y) {
        const itemData = ITEM_DATA[itemId];
        if (!itemData) return null;

        const itemImage = this.add.image(x, y, itemData.storage).setInteractive().setData({itemId, originX: x, originY: y, gridPos: null});
        const shape = itemData.shape;
        const itemHeightInCells = shape.length;
        const itemWidthInCells = shape[0] ? shape[0].length : 1;
        itemImage.setDisplaySize(itemWidthInCells * this.cellSize, itemHeightInCells * this.cellSize);

        this.input.setDraggable(itemImage); // これで自動的に内部でリスナーが登録される

        // 個々のアイテムのドラッグイベントリスナー
        itemImage.on('dragstart', (pointer, dragX, dragY) => {
            itemImage.setDepth(200);
            if (itemImage.getData('gridPos')) {
                this.removeItemFromBackpack(itemImage);
            }
        });
        itemImage.on('drag', (pointer, dragX, dragY) => {
            itemImage.setPosition(dragX, dragY);
        });
        itemImage.on('dragend', (pointer, dragX, dragY, dropped) => {
            itemImage.setDepth(100);
            const gridCol = Math.floor((pointer.x - this.gridX) / this.cellSize);
            const gridRow = Math.floor((pointer.y - this.gridY) / this.cellSize);
            if (this.canPlaceItem(itemImage, gridCol, gridRow)) {
                this.placeItemInBackpack(itemImage, gridCol, gridRow);
            } else {
                itemImage.x = itemImage.getData('originX');
                itemImage.y = itemImage.getData('originY');
            }
        });
        return itemImage; 
    }

    canPlaceItem(itemImage, startCol, startRow) {
        const itemData = ITEM_DATA[itemImage.getData('itemId')];
        const shape = itemData.shape;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] === 1) {
                    const checkRow = startRow + r;
                    const checkCol = startCol + c;
                    if (checkRow < 0 || checkRow >= this.backpackGridSize || checkCol < 0 || checkCol >= this.backpackGridSize) return false;
                    if (this.backpack[checkRow][checkCol] !== 0) return false;
                }
            }
        }
        return true;
    }

    placeItemInBackpack(itemImage, startCol, startRow) {
        const itemId = itemImage.getData('itemId');
        const itemData = ITEM_DATA[itemId];
        const shape = itemData.shape;
        itemImage.x = this.gridX + startCol * this.cellSize + (itemImage.width * itemImage.scaleX / 2);
        itemImage.y = this.gridY + startRow * this.cellSize + (itemImage.height * itemImage.scaleY / 2);
        itemImage.setData('gridPos', { col: startCol, row: startRow });
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] === 1) {
                    this.backpack[startRow + r][startCol + c] = itemId;
                }
            }
        }
        console.log(`アイテム[${itemId}]をグリッド(${startCol}, ${startRow})に配置`);
        console.log("現在のバックパック:", this.backpack);
    }

    removeItemFromBackpack(itemImage) {
        const itemId = itemImage.getData('itemId');
        const itemData = ITEM_DATA[itemId];
        const shape = itemData.shape;
        const gridPos = itemImage.getData('gridPos');
        if (!gridPos) return;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] === 1) {
                    this.backpack[gridPos.row + r][gridPos.col + c] = 0;
                }
            }
        }
        itemImage.setData('gridPos', null);
        console.log(`アイテム[${itemId}]をグリッドから削除`);
        console.log("現在のバックパック:", this.backpack);
    }

    // ★★★ 修正箇所: stop() メソッドで全てのPhaserオブジェクトを破棄するロジックを強化 ★★★
    stop() {
        super.stop();
        console.log("ActionScene (as BattleScene): stop されました。UI要素とイベントリスナーを破棄します。");

        // StateManagerのイベントリスナーを解除
        if (this.stateManager && this.onFVariableChangedListener) {
            this.stateManager.events.off('f-variable-changed', this.onFVariableChangedListener);
            this.onFVariableChangedListener = null;
        }
        
        // --- HUDオブジェクトを破棄 ---
        if (this.playerHpBar) { this.playerHpBar.destroy(); this.playerHpBar = null; }
        if (this.enemyHpBar) { this.enemyHpBar.destroy(); this.enemyHpBar = null; }
        if (this.coinHud) { this.coinHud.destroy(); this.coinHud = null; }

        // --- プレースホルダーテキストを破棄 ---
        if (this.playerPlaceholderText) { this.playerPlaceholderText.destroy(); this.playerPlaceholderText = null; }
        if (this.enemyPlaceholderText) { this.enemyPlaceholderText.destroy(); this.enemyPlaceholderText = null; }

        // --- バックパック関連のUIオブジェクトを破棄 ---
        if (this.backpackGridObjects.length > 0) {
            this.backpackGridObjects.forEach(obj => { if (obj) obj.destroy(); });
            this.backpackGridObjects = [];
        }

        // --- インベントリアイテムを破棄 (ドラッグリスナーもここで自動解除される) ---
        if (this.inventoryItems.length > 0) {
            this.inventoryItems.forEach(item => { if (item) item.destroy(); });
            this.inventoryItems = [];
        }

        // --- ボタンと関連するテキストを破棄 ---
        if (this.startBattleButton) { this.startBattleButton.off('pointerdown'); this.startBattleButton.destroy(); this.startBattleButton = null; }
        if (this.battleLogText) { this.battleLogText.destroy(); this.battleLogText = null; }

        if (this.winButton) { this.winButton.off('pointerdown'); this.winButton.destroy(); this.winButton = null; }
        if (this.loseButton) { this.loseButton.off('pointerdown'); this.loseButton.destroy(); this.loseButton = null; }
        if (this.retryButton) { this.retryButton.off('pointerdown'); this.retryButton.destroy(); this.retryButton = null; }
        if (this.titleButton) { this.titleButton.off('pointerdown'); this.titleButton.destroy(); this.titleButton = null; }
        if (this.gameOverText) { this.gameOverText.destroy(); this.gameOverText = null; } 

        // 戦闘中の遅延Callがあれば停止（もしstartBattle内でtime.delayedCallをプロパティに保持していれば）
        // 例: if (this.battleTurnTimer) { this.battleTurnTimer.remove(); }
    }

    onFVariableChanged(key, value) {
        if (key === 'coin' && this.coinHud && this.coinHud.coinText.text !== value.toString()) {
            this.coinHud.setCoin(value);
        } else if (key === 'player_hp' && this.playerHpBar) {
            const maxHp = this.stateManager.f.player_max_hp || 100;
            this.playerHpBar.setHp(value, maxHp);
        } else if (key === 'player_max_hp' && this.playerHpBar) {
            const currentHp = this.stateManager.f.player_hp || 0;
            this.playerHpBar.setHp(currentHp, value);
        } else if (key === 'enemy_hp' && this.enemyHpBar) { 
            const maxHp = this.stateManager.f.enemy_max_hp || 500;
            this.enemyHpBar.setHp(value, maxHp);
        } else if (key === 'enemy_max_hp' && this.enemyHpBar) { 
            const currentHp = this.stateManager.f.enemy_hp || 0;
            this.enemyHpBar.setHp(currentHp, value);
        }
    }


    endBattle(result) {
        if (this.battleEnded) return;
        this.battleEnded = true;

        console.log(`ActionScene (as BattleScene): バトル終了。結果: ${result}`);
        
        this.input.enabled = false; // シーン全体の入力を無効化
        // winButton/loseButtonはendBattleの呼び出し元で無効化済み、stop()で破棄される

        // ★★★ 修正箇所: SystemSceneへのイベント発行を eventEmitted フラグで制御 ★★★
        if (!this.eventEmitted) {
            this.eventEmitted = true; // イベント発行フラグを立てる

            if (result === 'win') {
                this.scene.get('SystemScene').events.emit('return-to-novel', {
                    from: this.scene.key,
                    params: { 
                        'f.battle_result': 'win',
                        'f.player_hp': this.playerStats.hp, 
                        'f.coin': this.stateManager.f.coin 
                    }
                });
            } else {
                // 敗北時: ゲームオーバー処理
                console.log("ActionScene (as BattleScene): ゲームオーバー処理を開始します。");
                
                // ゲームオーバーUIの生成
                this.gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, 'GAME OVER', { fontSize: '64px', fill: '#f00', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(999);
                this.retryButton = this.add.text(this.scale.width / 2, this.scale.height / 2 + 50, 'もう一度挑戦', { fontSize: '32px', fill: '#fff', backgroundColor: '#880000', padding: { x: 20, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(999);
                this.titleButton = this.add.text(this.scale.width / 2, this.scale.height / 2 + 120, 'タイトルに戻る', { fontSize: '32px', fill: '#fff', backgroundColor: '#444444', padding: { x: 20, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(999);
                
                this.input.enabled = true; // 新しいボタンを有効化するため、シーンの入力を再度有効化

                // ★★★ 追加: ゲームオーバーボタンクリック時の入力無効化とイベント発行制御 ★★★
                this.retryButton.on('pointerdown', () => {
                    this.retryButton.disableInteractive();
                    if (this.titleButton) this.titleButton.disableInteractive();
                    if (!this.eventEmitted) { // 二重発行防止
                        this.eventEmitted = true;
                        console.log("ActionScene (as BattleScene): もう一度挑戦します。");
                        this.scene.get('SystemScene').events.emit('request-scene-transition', {
                            to: this.scene.key, // BattleScene自身
                            from: this.scene.key,
                            params: this.initialBattleParams
                        });
                    }
                });

                this.titleButton.on('pointerdown', () => {
                    this.titleButton.disableInteractive();
                    if (this.retryButton) this.retryButton.disableInteractive();
                    if (!this.eventEmitted) { // 二重発行防止
                        this.eventEmitted = true;
                        console.log("ActionScene (as BattleScene): タイトルに戻ります。");
                        this.scene.get('SystemScene').events.emit('return-to-novel', {
                            from: this.scene.key,
                            params: { 'f.battle_result': 'game_over' }
                        });
                    }
                });
            }
        } else {
            console.warn("BattleScene: イベントが既に発行されているか、結果が不明なためイベントは発行されません。");
        }
    }

    resume() {
        console.log("ActionScene (as BattleScene): resume されました。入力を再有効化します。");
        this.input.enabled = true;
    }
}