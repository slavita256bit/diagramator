package library;

import java.util.List;

public class Book extends Item {
    private String isbn;
    private Genre genre;
    private List<Author> authors;       // aggregation

    public Book(String title, String isbn) { super(title); this.isbn = isbn; }

    @Override
    public int loanDays() { return 21; }
}
