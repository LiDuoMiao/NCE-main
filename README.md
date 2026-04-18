
# 新概念英语 · 全四册在线点读系统

[![Stars](https://img.shields.io/github/stars/LiDuoMiao/nce-main.svg?style=social)](https://github.com/LiDuoMiao/NCE-main/stargazers)
[![License](https://img.shields.io/github/license/LiDuoMiao/NCE-main)](https://github.com/LiDuoMiao/NCE-main/blob/master/LICENSE)

**《 New Concept English 》** 全四册在线学习系统，集课文朗读、单句点读、中英对照、单词即点即译、PDF教材同步浏览于一体，随时随地自学英语！

---

### ✨ 主要功能

- 🎧 **美音课文朗读**：流畅自然的原版音频
- 📍 **单句点读**：点击任意句子即可跟读练习
- 📖 **中英对照**：逐句显示中英文，便于理解
- 📝 **单词即点即译**：点击任意单词，弹出词典风格的翻译弹窗
- 📚 **PDF 教材对照**：集成 PDF 教材查看器，听读与教材同步
- 📝 **学习笔记**：右侧标签切换查看词汇、短语、语法、句型学习笔记
- 📱 **响应式设计**：手机，平板、电脑均可流畅使用
- 🚀 **无需安装**：浏览器直接访问，随时学习

---

### 🚀 在线体验

[**👉 点击访问：新概念英语在线学习**](https://new-concept-english-online.vercel.app)

---

### 📸 截图

![pc_1.jpg](screenshot/pc_1.png)

![pc_2.jpg](screenshot/pc_2.png)

![pc_3.jpg](screenshot/pc_3.png)

![pc_4.jpg](screenshot/pc_4.png)

### 📚 四册学习指南

#### 📕 第一册：《First Things First》
**目标**：打好语音与基础
**课数**：144课 | **词汇量**：约 600 词
适合 **零基础** 学习者，建立语感和正确发音。

#### 📘 第二册：《Practice and Progress》
**目标**：语法体系与听说读写同步提升
**课数**：96课 | **词汇量**：约 1500 词
适合有基础的学习者，系统梳理语法。

#### 📙 第三册：《Developing Skills》
**目标**：进阶阅读与复杂句型
**课数**：60课 | **词汇量**：约 2500 词
适合想提高综合能力、阅读原版材料的学习者。

#### 📗 第四册：《Fluency in English》
**目标**：接近流利表达与学术阅读
**课数**：48课 | **词汇量**：约 3500–4000 词
适合高阶学习者、考研/雅思/托福备考。

**推荐学习路径**：按册顺序学习 → 第一册打基础 → 第四册冲刺流利。

---

### 🛠️ 技术与资源

- **前端**：HTML + CSS + JavaScript（纯静态实现）
- **音频来源**：美音音频来自 [tangx/New-Concept-English](https://github.com/tangx/New-Concept-English)
- **中文字幕**：由 Gemini AI 生成（已尽力优化，但可能存在少量错误，欢迎大家指正与贡献）
- **翻译 API**：
  - [Free Dictionary API](https://dictionaryapi.dev/) - 提供英文释义、音标
  - [LibreTranslate](https://libretranslate.com/) - 开源自托管翻译引擎
  - 完全免费，基于前端调用，直接运行即可使用完整功能

---

### 🚀 安装使用

#### 1. 启动翻译服务（LibreTranslate）

##### 方式一：Docker Compose（推荐）

```bash
docker-compose up -d
# 服务地址：http://localhost:5001
```

##### 方式二：Docker 命令行

```bash
docker run -d \
  --name libretranslate \
  -p 5001:5000 \
  --restart unless-stopped \
  libretranslate/libretranslate:latest \
  --load-only en,zh \
  --batch-limit 20 \
  --threads 4 \
  --req-limit -1 \
  --char-limit -1
```

##### 方式三：pip 安装（无 Docker）

```bash
pip install libretranslate
libretranslate --load-only en,zh
libretranslate
```

#### 2. 部署前端

##### 方式一：Python HTTP 服务器（快速测试）

```bash
cd NCE-main
python3 -m http.server 8088
# 浏览器打开 http://localhost:8088
```

##### 方式二：Nginx 部署

```nginx
server {
    listen 80;
    server_name your_domain.com;
    root /path/to/NCE-main;
    index index.html;
}
```

##### 方式三：Tomcat 部署

```bash
# 直接复制到 webapps 目录
cp -r NCE-main /path/to/tomcat/webapps/
# 访问地址：http://localhost:8080/NCE-main/
```

---

### ⚠️ 说明与版权

- 本项目**仅供个人学习研究使用**，非商业用途。
- 所有内容来源于互联网，我们不拥有版权。
- 如有侵权，请联系 [alexlibin.cn@gmail.com](mailto:alexlibin.cn@gmail.com)和[me@ichochy.com](mailto:me@ichochy.com) 及时处理。
- **强烈建议**支持正版，购买官方教材与音频。

---

### 🤝 如何贡献

欢迎大家一起完善这个项目！

- 提交 Issue 反馈翻译错误、功能建议
- Pull Request 改进代码、修正字幕、添加新功能
- 分享给更多英语学习者

---

### ❤️ 支持原作者

原作者 iChochy 是 80 后码农，目前正在与白血病（CMML）抗争。
工作已暂停，在家无聊就重学英语，就有了这个项目。

如果这个项目对你学习英语有帮助，欢迎：

- **点个 Star** ⭐（[给原作者点个 Star](https://github.com/ichochy/nce)）
- 打赏一杯咖啡 / 一点生命值（可选）

<img src="sponsor.jpg" width="200" />

**感谢每一位使用和支持的朋友！**
你的每一次学习，都是对坚持最好的回报。

---

### 📦 关于本修改版

本版本基于 [iChochy/NCE](https://github.com/ichochy/nce) 改编，新增了单词即点即译、PDF教材同步浏览和学习笔记功能。

**修改者**：[LiDuoMiao](https://github.com/LiDuoMiao)
**GitHub**：https://github.com/LiDuoMiao/NCE-main
**Email**：[alexlibin.cn@gmail.com](mailto:alexlibin.cn@gmail.com)

---

**Keep learning — progress comes with persistence.**
**坚持学习，每一天都有进步。**
