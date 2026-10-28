namespace Vitaloop.Crm.Web.ViewModels.Shared;

public enum EditableTableCellKind
{
    Text,
    Code,
    Badge,
    InputText,
    InputNumber,
    Select,
}

public enum EditableTableFieldKind
{
    Hidden,
    Text,
    Number,
    Select,
}

public sealed class EditableTableViewModel
{
    public required string Title { get; init; }
    public required IReadOnlyList<string> Columns { get; init; }
    public string EmptyMessage { get; init; } = "No records yet.";
    public IReadOnlyList<EditableTableRowViewModel> Rows { get; init; } = Array.Empty<EditableTableRowViewModel>();
}

public sealed class EditableTableRowViewModel
{
    public required string RowKey { get; init; }
    public required IReadOnlyList<EditableTableCellViewModel> Cells { get; init; }
    public EditableTableActionViewModel? PrimaryAction { get; init; }
    public IReadOnlyList<EditableTableActionViewModel> SecondaryActions { get; init; } = Array.Empty<EditableTableActionViewModel>();
}

public sealed class EditableTableCellViewModel
{
    public EditableTableCellKind Kind { get; init; } = EditableTableCellKind.Text;
    public string Text { get; init; } = string.Empty;
    public string BadgeTone { get; init; } = "secondary";
    public string? Name { get; init; }
    public string? Value { get; init; }
    public string? Placeholder { get; init; }
    public string? CssClass { get; init; }
    public IReadOnlyList<EditableTableOptionViewModel> Options { get; init; } = Array.Empty<EditableTableOptionViewModel>();
}

public sealed class EditableTableActionViewModel
{
    public required string ActionUrl { get; init; }
    public string Method { get; init; } = "post";
    public required string SubmitLabel { get; init; }
    public string SubmitButtonClass { get; init; } = "btn btn-xs btn-outline";
    public string? ConfirmMessage { get; init; }
    public IReadOnlyList<EditableTableFieldViewModel> Fields { get; init; } = Array.Empty<EditableTableFieldViewModel>();
}

public sealed class EditableTableFieldViewModel
{
    public EditableTableFieldKind Kind { get; init; } = EditableTableFieldKind.Text;
    public required string Name { get; init; }
    public string Value { get; init; } = string.Empty;
    public string? Placeholder { get; init; }
    public string? CssClass { get; init; }
    public IReadOnlyList<EditableTableOptionViewModel> Options { get; init; } = Array.Empty<EditableTableOptionViewModel>();
}

public sealed class EditableTableOptionViewModel
{
    public required string Value { get; init; }
    public required string Label { get; init; }
    public bool Selected { get; init; }
}
