# Auto Tab Kill

A Firefox extension that automatically manages your tabs to improve browser performance and memory usage.

## Features

- **Automatic Tab Management**
  - Closes inactive tabs based on customizable time limits
  - Unloads tabs to free up memory while keeping them in the tab bar
  - Auto-kills unloaded tabs after 24 hours to prevent memory bloat
  - Manual unload button to immediately unload inactive tabs

- **Smart Tab Handling**
  - Multiple behavior modes for different use cases:
    - Only close duplicate tabs (ignoring query parameters)
    - Only close exact duplicate tabs
    - Close tabs from the same domain (keeping the newest)
    - Always close after inactivity
    - Never close automatically

- **Customizable Settings**
  - Enable/disable the extension
  - Set custom inactivity time limits
  - Configure unload interval (default: 30 minutes)
  - Toggle auto-kill for unloaded tabs
  - Choose default behavior mode
  - Enable/disable notifications

- **URL Pattern Management**
  - Define custom rules for specific URLs
  - Support for wildcards and regular expressions
  - Built-in presets for common cases
  - Easy-to-use pattern editor

- **History Tracking**
  - View recently closed and unloaded tabs
  - See when tabs were closed or unloaded
  - Quick access to closed tab history

## Usage

1. Click the extension icon to open the popup
2. Configure your preferred settings:
   - Set inactivity time limit
   - Choose unload interval
   - Enable/disable auto-kill for unloaded tabs
   - Select default behavior
3. Use the "Unload Inactive Tabs" button to manually unload tabs
4. View your closed tab history in the popup
5. Access advanced settings through the options page

## Advanced Configuration

### URL Patterns

You can define custom rules for specific URLs using patterns:

- `about:*` - Matches all about: pages
- `*.example.com/*` - Matches all pages on example.com
- `https://github.com/*` - Matches all GitHub pages

### Behavior Modes

1. **Duplicate (Ignore Query)**: Closes duplicate tabs, ignoring URL parameters
2. **Exact Duplicate**: Only closes tabs with exactly the same URL
3. **Same Domain**: Closes older tabs from the same domain
4. **Always**: Closes any tab after the inactivity period
5. **Never**: Disables automatic closing

## Privacy

This extension:
- Only accesses tab information necessary for its functionality
- Stores all data locally in your browser
- Does not collect or transmit any user data
- Requires minimal permissions to function

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
