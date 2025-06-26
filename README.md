# Scope - UI Component Analysis Platform

A comprehensive platform for analyzing and extracting UI components from websites using both DOM analysis and computer vision.

## 🎯 What is Scope?

Scope is a research platform that combines two powerful approaches to understand website UI components:

1. **DOMExtraction** - A Chrome extension that analyzes the DOM structure
2. **ComputerVision** - A Python pipeline that uses AI to detect UI elements visually

## 🏗️ Architecture

```
Scope/
├── DOMExtraction/          # Chrome extension for DOM analysis
│   ├── src/               # Extension source code
│   ├── build/             # Built extension files
│   └── README.md          # Detailed extension documentation
├── ComputerVision/         # AI-powered visual analysis
│   ├── phase1_screenshot.py    # Screenshot capture
│   ├── phase2_detection.py     # AI component detection
│   ├── phase3_visualization.py # Result visualization
│   └── README.md          # Detailed CV documentation
└── README.md              # This overview
```

## 🚀 Key Features

### DOMExtraction Extension

- **Real-time DOM Analysis**: Collects interactive elements from web pages
- **Advanced Filtering**: Multi-stage filtering with visibility and spatial analysis
- **Screenshot Capture**: Downloads organized screenshots of detected components
- **LLM Integration**: AI-powered element classification and analysis
- **Visual Highlighting**: Real-time highlighting with scroll resistance

### ComputerVision Pipeline

- **Automated Screenshots**: Consistent, high-quality website captures
- **AI Detection**: GPT-4 Vision API for precise component detection
- **13+ Component Types**: Buttons, links, inputs, images, text, and more
- **Visualization**: Color-coded bounding boxes with annotations
- **High Accuracy**: 80-95% detection accuracy across component types

## 🛠️ Quick Start

### DOMExtraction Extension

```bash
cd DOMExtraction
npm install
npm run build
# Load build/ folder in Chrome Extensions
```

### ComputerVision Pipeline

```bash
cd ComputerVision
pip install -r requirements.txt
# Set OPENAI_API_KEY in environment
python phase1_screenshot.py --url "https://example.com"
python phase2_detection.py
python phase3_visualization.py
```

## 📊 Use Cases

- **UI/UX Research**: Analyze design patterns across websites
- **Component Libraries**: Extract reusable UI components
- **Accessibility Testing**: Identify missing accessibility features
- **Design System Analysis**: Compare component usage patterns
- **Quality Assurance**: Validate UI component detection accuracy

## 🔗 Integration

The two components can work together:

- Use DOMExtraction to collect screenshots
- Process them through ComputerVision for AI analysis
- Compare DOM structure with visual detection
- Generate comprehensive UI component reports

## 📚 Documentation

- **[DOMExtraction README](DOMExtraction/README.md)** - Complete extension documentation
- **[ComputerVision README](ComputerVision/README.md)** - Detailed pipeline documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Built for UI/UX researchers and web developers**
